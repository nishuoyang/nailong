import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  /** 错误日志节流：Redis 长时间不可用时不要每个命令打一行 */
  private lastErrorLoggedAt = 0;
  private static readonly ERROR_LOG_INTERVAL_MS = 10_000;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.configService.get<string>('REDIS_PORT', '6379')),

      // --- 以下四项都是为了「Redis 挂掉时快速失败」，而不是把请求长时间挂住 ---
      //
      // 1. 连接超时 2s（默认 10s）
      // 2. 单条命令最多重试 2 次（默认 20 次）：默认值下 Redis 不可用时命令会重试到超时，
      //    表现为接口「既不成功也不失败」地长时间挂起
      // 3. 关闭离线队列（默认 true）：连接不可用时命令立即报错，不再排队等待连接恢复
      // 4. 重连退避上限 2s（默认无限增长到 30s+）
      connectTimeout: 2000,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });

    // 必须挂 error 监听：否则 ioredis 会以 "Unhandled error event" 形式直接打印到 stderr
    this.redis.on('error', (err: Error) => this.logErrorThrottled(err));
    this.redis.on('ready', () => this.logger.log('Redis 已连接'));
    this.redis.on('end', () => this.logger.warn('Redis 连接已断开'));
  }

  /**
   * 底层客户端。仅在确实需要上面没有封装的能力时使用；
   * 业务代码请优先使用 get/set/del —— 它们自带 fail-open 保护。
   */
  get client(): Redis {
    return this.redis;
  }

  /** Redis 当前是否可用（用于健康检查/诊断） */
  get status(): string {
    return this.redis.status;
  }

  /**
   * 安全读：Redis 不可用时返回 null。
   *
   * 这是「fail-open」：调用方必须把 null 当作「没读到」处理，并自行决定兜底值。
   *
   * ⚠️ 正因为 null 有歧义 ——「键不存在」和「Redis 挂了」返回的都是 null ——
   * **绝不能把 Redis 当唯一存储**。站点开关（关闭注册 / 限制登录）原来就是这么存的，
   * 于是 Redis 一被清空，两个开关就静默恢复成「开放」，管理员还以为关着。
   * 开关现在落库了（见 SettingsService）；这里只放「丢了能重建」的数据（验证码、推荐缓存）。
   * 确实需要区分这两种 null 时，用 status 判断或直接读数据库，不要靠猜。
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logErrorThrottled(err as Error);
      return null;
    }
  }

  /**
   * 安全写：返回是否真的写成功。
   *
   * 调用方在「写失败会导致状态显示与真实状态不一致」时必须检查返回值并报错。
   * 目前必须检查的是验证码：写失败还返回 SVG 的话，用户填对了也永远验证不过。
   *
   * @param ttlSeconds 传入则使用 SET key value EX ttl
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds !== undefined) {
        await this.redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (err) {
      this.logErrorThrottled(err as Error);
      return false;
    }
  }

  /** 安全删：失败只记日志 */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logErrorThrottled(err as Error);
    }
  }

  /**
   * 哈希字段自增（fail-open）。视图计数用：读接口不再写 SQLite，
   * 增量先进 Redis，由定时任务批量回写（见 ImagesService.flushViewCounts）。
   * Redis 不可用时静默放弃本次计数，调用方无需感知。
   */
  async hincrby(key: string, field: string, increment: number): Promise<void> {
    try {
      await this.redis.hincrby(key, field, increment);
    } catch (err) {
      this.logErrorThrottled(err as Error);
    }
  }

  /**
   * 安全读整个哈希（fail-open）：视图增量表用。
   * 与 get() 不同，这里的「空对象」在两种情况下语义一致 ——
   * 键不存在 = 没有待回写增量，Redis 不可用同样按「没有增量」处理，
   * 不存在把 Redis 缓存当唯一存储的歧义问题（DB 值才是来源，增量丢了能重建）。
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redis.hgetall(key);
    } catch (err) {
      this.logErrorThrottled(err as Error);
      return {};
    }
  }

  /** 安全读哈希字段：Redis 不可用时返回 null（调用方按「无增量」兜底） */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis.hget(key, field);
    } catch (err) {
      this.logErrorThrottled(err as Error);
      return null;
    }
  }

  private logErrorThrottled(err: Error) {
    const now = Date.now();
    if (now - this.lastErrorLoggedAt < RedisService.ERROR_LOG_INTERVAL_MS) return;
    this.lastErrorLoggedAt = now;
    this.logger.error(
      `Redis 不可用（status=${this.redis.status}）：${err.message}。依赖缓存的功能将降级运行。`,
    );
  }

  async onModuleDestroy() {
    // quit() 在连接已断开时会抛错，这里静默处理，避免退出时刷一堆日志
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
