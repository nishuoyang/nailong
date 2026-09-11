import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'

/** 已知的站点开关。新增开关只需在这里加一项 + 在 SETTING_DEFAULTS 里加一条默认值。 */
export const SETTING_KEYS = ['registration', 'login_restricted'] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

/**
 * 数据库里没有对应行时的取值。
 *
 * 与改动前的线上行为**逐字一致**：注册开关原来的判断是 `!== 'false'`（取不到即视为开放），
 * 登录限制原来的判断是 `=== 'true'`（取不到即视为不限制）。
 * 保持一致是为了让这次改动只修「持久化」，不顺手改变任何默认语义。
 */
const SETTING_DEFAULTS: Record<SettingKey, boolean> = {
  registration: true,
  login_restricted: false,
}

/** 对外语义化的设置对象，字段名与 GET /admin/settings 的响应一致 */
export interface SiteSettings {
  registrationOpen: boolean
  loginRestricted: boolean
}

/** 旧版把开关存在 Redis 的这个前缀下。保留它只用于一次性迁移（见 onModuleInit）。 */
const LEGACY_REDIS_PREFIX = 'setting:'

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name)

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  /**
   * 启动时做两件事：一次性迁移旧值、把当前生效的开关打进日志。
   *
   * **一次性迁移**：把历史上只存在于 Redis 的开关值搬进数据库。
   * 为什么必须做：如果直接改成「只读数据库」，而某个部署此前把「关闭注册」存在了 Redis 里，
   * 升级后数据库没有对应行 → 落到默认值 → **静默恢复成开放**。
   * 那正是本次要修的故障，不能换个形式重新引入。
   *
   * 只在「数据库里没有这一行」且「Redis 里确实有值」时才写入，所以它是自消除的：
   * 迁移过一次之后条件永远不成立，正常启动不会产生任何写入。
   * 迁移后**不再碰** Redis 里的旧键 —— 留着，回滚到旧镜像时旧代码还要读它。
   */
  async onModuleInit() {
    try {
      const rows = await this.prisma.setting.findMany({ select: { key: true } })
      const existing = new Set(rows.map((row) => row.key))
      const missing = SETTING_KEYS.filter((key) => !existing.has(key))

      // 常态：开关都已落库，这一步直接返回，连 Redis 都不碰
      if (missing.length > 0) {
        await this.waitForRedisReady()
        for (const key of missing) {
          const legacy = await this.redisService.get(`${LEGACY_REDIS_PREFIX}${key}`)
          if (legacy === null) continue
          const value = this.resolve(key, legacy)
          await this.prisma.setting.create({ data: { key, value: this.encode(value) } })
          this.logger.warn(`已把旧版仅存于 Redis 的开关迁移到数据库：${key}=${value}`)
        }
      }

      // 把生效值打进启动日志。这一行的作用是：万一以后又出现「管理员以为关着、实际是开的」，
      // 日志里能直接看到进程启动那一刻读到的到底是什么，不用再去猜。
      const effective = await this.getAll()
      this.logger.log(
        `站点开关（来源：数据库）：注册开放=${effective.registrationOpen ? '是' : '否'}，` +
          `限制登录=${effective.loginRestricted ? '是' : '否'}`,
      )
    } catch (err) {
      // 迁移/日志失败不能阻止启动：读设置时会退回默认值，与旧版行为一致
      this.logger.error(`设置初始化失败（不影响启动）：${(err as Error).message}`)
    }
  }

  /**
   * 等 Redis 连接就绪。
   *
   * ioredis 是异步建连的，而 RedisService 关掉了离线队列（enableOfflineQueue=false），
   * 意味着「连接尚未就绪时命令直接报错」——而 RedisService.get 会把错误吞成 null。
   * 不等待就去查询，会把「Redis 还没连上」误判成「Redis 里没有这个键」，
   * 于是**悄悄漏掉迁移**。所以这里先等它 ready（最多 2 秒）。
   */
  private async waitForRedisReady(): Promise<void> {
    if (this.redisService.status === 'ready') return
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (this.redisService.status === 'ready') return
    }
    this.logger.warn(
      `等待 Redis 就绪超时（当前 status=${this.redisService.status}）：` +
        `本次跳过旧开关迁移检查，未落库的开关将使用代码里的默认值。` +
        `如果线上原本关着注册，请到后台确认一次。`,
    )
  }

  /** 管理后台读取：直接回源数据库，保证页面显示的一定是已落盘的值 */
  async getAll(): Promise<SiteSettings> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    })
    const stored = new Map(rows.map((row) => [row.key, row.value]))
    return {
      registrationOpen: this.resolve('registration', stored.get('registration')),
      loginRestricted: this.resolve('login_restricted', stored.get('login_restricted')),
    }
  }

  /**
   * 热路径读取单个开关（注册/登录各一次）。
   *
   * 这里故意**不加 Redis 缓存**：省下的是一次 SQLite 主键查询（微秒级），
   * 而同一条请求里的 bcrypt（cost 12，约 250ms）比它贵 4~5 个数量级。
   * 缓存换不来可感知的收益，却会重新引入「缓存与数据库不一致」这一整类问题。
   * 顺带的好处：Redis 挂掉不再影响登录/注册的开关判断。
   */
  async getFlag(key: SettingKey): Promise<boolean> {
    try {
      const row = await this.prisma.setting.findUnique({ where: { key } })
      return this.resolve(key, row?.value)
    } catch (err) {
      // 只有连数据库都读不到时才退回默认值（fail-open），与旧版「Redis 故障即放行」一致：
      // 配置读取失败不应该把登录/注册整个功能打死。此时数据库已不可用、站点本来也无法工作，
      // 所以日志里明确记一条。
      this.logger.error(
        `读取开关 ${key} 失败，暂用默认值 ${SETTING_DEFAULTS[key]}：${(err as Error).message}`,
      )
      return SETTING_DEFAULTS[key]
    }
  }

  isRegistrationOpen(): Promise<boolean> {
    return this.getFlag('registration')
  }

  isLoginRestricted(): Promise<boolean> {
    return this.getFlag('login_restricted')
  }

  /**
   * 更新开关。
   *
   * 旧实现把「写 Redis 失败」当成失败并返回 503 —— 因为那时 Redis 就是唯一存储。
   * 现在数据库是唯一存储、Redis 完全不参与，所以**只要这里没抛错就说明真的落盘了**：
   * 管理员不会再遇到「提示已保存、重启后却变回去」。
   */
  async update(patch: Partial<SiteSettings>, updatedBy?: string | null): Promise<SiteSettings> {
    const writes: Array<{ key: SettingKey; value: boolean }> = []
    if (patch.registrationOpen !== undefined) {
      writes.push({ key: 'registration', value: patch.registrationOpen })
    }
    if (patch.loginRestricted !== undefined) {
      writes.push({ key: 'login_restricted', value: patch.loginRestricted })
    }

    if (writes.length > 0) {
      // 放在一个事务里：要么两个开关都写成功，要么都不写，不留下「半套设置」
      await this.prisma.$transaction(
        writes.map(({ key, value }) =>
          this.prisma.setting.upsert({
            where: { key },
            create: { key, value: this.encode(value), updatedBy: updatedBy ?? null },
            update: { value: this.encode(value), updatedBy: updatedBy ?? null },
          }),
        ),
      )
    }

    return this.getAll()
  }

  /**
   * 把库里的原始字符串解释成布尔值。
   *
   * 只认 'true'/'false'（写入一律经过 encode），其它值一律按默认值处理：
   * 万一将来有人手工往表里塞了脏数据，也不会被解读成「意外关掉了注册」这种状态。
   */
  private resolve(key: SettingKey, raw: string | undefined | null): boolean {
    if (raw === 'true') return true
    if (raw === 'false') return false
    return SETTING_DEFAULTS[key]
  }

  private encode(value: boolean): string {
    return value ? 'true' : 'false'
  }
}
