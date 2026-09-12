import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { Prisma } from '@prisma/client'

// 将 Prisma 嵌套的 categories 扁平化：{ category: { id, name, slug } }[] → { id, name, slug }[]
function flattenCategories(image: any) {
  if (!image?.categories) return image
  return {
    ...image,
    categories: image.categories.map((c: any) => c.category),
  }
}

// 分页上界：100 万页（size ≤ 100 时 skip 最大 1e8，离 Prisma 的 64 位整数上界
// 2^63-1 ≈ 9.2e18 还有 10 个数量级的余量，纯防御性）。
//
// 为什么必须有上界 —— 实测 `GET /api/images?page=99999999999999999999` 会打穿到
// SQLite 层：`Number('…999')` 是 1e20（有限、>0，parsePage 原先放行），
// `skip = (page-1)*size ≈ 2e21`，Prisma 引擎抛
// `Unable to fit value 2e+21 into a 64-bit signed integer for field 'skip'` → 500，
// 并被全局过滤器记一条 error 日志。
// 超出业务上不可能到达的上界视为请求非法（400）—— 一个畸形参数不该触发 5xx 告警。
const MAX_PAGE = 1_000_000

// --- 视图计数（待办 #5，2026-09-11）---
//
// 此前每次详情页 GET 都在读接口里执行一次 SQLite 写事务（viewCount+1）——
// WAL 解决了「写阻塞读」，但读请求仍要为一次真实写多付一次 RTT。
// 现在改成：读时只 HINCRBY 一个 Redis 哈希（field = 图片 id，延迟 ~0.1ms、fire-and-forget），
// 由 flushViewCounts 定时批量回写 SQLite；展示数 = SQLite 已落库值 + 哈希里的待回写增量。
// Redis 不可用时 hincrby/hget/hgetall 全部 fail-open（静默不计数 / 按无增量处理），接口不受影响。
const VIEW_COUNT_HASH = 'view:cnt'
const VIEW_COUNT_FLUSH_MS = 30_000

// 安全解析分页参数，防止 NaN 和负数
function parsePage(page?: number): number {
  const p = Number(page)
  if (Number.isFinite(p) && p > MAX_PAGE) {
    throw new BadRequestException(`page 超过最大允许值 ${MAX_PAGE}`)
  }
  return Number.isFinite(p) && p > 0 ? Math.floor(p) : 1
}
function parseSize(size?: number): number {
  const s = Number(size)
  return Number.isFinite(s) && s > 0 ? Math.min(Math.floor(s), 100) : 20
}

@Injectable()
export class ImagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImagesService.name)
  private flushTimer: NodeJS.Timeout | null = null

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async onModuleInit() {
    // unref：定时器不持有事件循环（即使进程无事可做也能正常退出）
    this.flushTimer = setInterval(() => void this.flushViewCounts(), VIEW_COUNT_FLUSH_MS)
    this.flushTimer.unref()
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer)
    // 最后一把：优雅关闭时把未回写的增量落库。
    // 就算没跑到这里（SIGKILL），增量仍留在 Redis 哈希里，重启后首次 flush 会补上 ——
    // 只有 Redis 容器自己重启才会丢，而视图本就是可丢失的分析数据。
    await this.flushViewCounts()
  }

  /**
   * 把 Redis 里的待回写视图增量批量写进 SQLite。
   *
   * 顺序必须是「先清哈希、再写库」（at-most-once）：
   *   - 先 HDEL：崩溃在 UPDATE 之前最多丢掉这一批计数（视图丢了可接受）；
   *   - 绝不先 UPDATE 再 HDEL —— 那会在两者之间崩溃时把同一批计数重复计入，
   *     而视图数只增不减，一旦虚高就永远无法自愈。
   * 清哈希之后新到达的 HINCRBY 落在新的哈希实例上，不会与这一批混淆。
   */
  private async flushViewCounts(): Promise<void> {
    const deltas = await this.redisService.hgetall(VIEW_COUNT_HASH)
    const entries = Object.entries(deltas)
      .map(([id, raw]) => [id, Number(raw)] as const)
      .filter(([, n]) => Number.isInteger(n) && n > 0)
    if (entries.length === 0) return

    await this.redisService.del(VIEW_COUNT_HASH)

    for (const [id, n] of entries) {
      // updateMany 匹配不到行（图片已被删除）也不抛错，静默跳过
      await this.prisma.image.updateMany({
        where: { id },
        data: { viewCount: { increment: n } },
      })
    }

    this.logger.log(
      `视图计数回写 SQLite：${entries.length} 张图片，合计 ${entries.reduce((s, [, n]) => s + n, 0)} 次`,
    )
  }

  async findAll(params: {
    page?: number
    size?: number
    category?: string
    search?: string
    sort?: 'latest' | 'popular' | 'downloads'
  }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)
    const { category, search, sort = 'latest' } = params

    const where: Prisma.ImageWhereInput = {
      status: 'approved',
      section: 'general',
    }

    if (category) {
      where.categories = {
        some: { category: { slug: category } },
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const orderBy: Prisma.ImageOrderByWithRelationInput =
      sort === 'popular'
        ? { likeCount: 'desc' }
        : sort === 'downloads'
          ? { downloadCount: 'desc' }
          : { createdAt: 'desc' }

    const [raw, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
        },
        orderBy,
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    const data = raw.map(flattenCategories)

    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 } }
  }

  async findById(id: string, userId?: string) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        categories: { include: { category: true } },
      },
    })

    if (!image) throw new NotFoundException('图片不存在')

    // 非公开图片仅允许上传者和管理员查看
    if (image.status !== 'approved') {
      if (!userId) throw new NotFoundException('图片不存在')
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      if (!user || (user.id !== image.userId && user.role !== 'admin')) {
        throw new NotFoundException('图片不存在')
      }
    }

    // 增加浏览次数：只写 Redis（fire-and-forget），由 flushViewCounts 每 30s 批量回写。
    // 读接口不再执行写事务；Redis 不可用时静默放弃本次计数，接口不受影响。
    await this.redisService.hincrby(VIEW_COUNT_HASH, id, 1)

    let isLiked = false
    if (userId) {
      const like = await this.prisma.like.findUnique({
        where: { userId_imageId: { userId, imageId: id } },
      })
      isLiked = !!like
    }

    // 展示数 = 已落库值 + 尚未回写的增量。回写完成（哈希被清）后增量自然归零，
    // 长时间不刷新页面也不会看到虚高。
    const pending = await this.redisService.hget(VIEW_COUNT_HASH, id)
    const viewCount = image.viewCount + (pending ? Number(pending) : 0)
    return flattenCategories({ ...image, viewCount, isLiked })
  }

  // 其他推荐：section='other' 的 approved 图片
  async getOther(params: { page?: number; size?: number }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)

    const where: Prisma.ImageWhereInput = {
      status: 'approved',
      section: 'other',
    }

    const [raw, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    const data = raw.map(flattenCategories)
    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 } }
  }

  // 精选推荐：管理员手动标记的 isFeatured 图片
  async getFeatured(params: { page?: number; size?: number }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)

    const where: Prisma.ImageWhereInput = {
      status: 'approved',
      isFeatured: true,
    }

    const [raw, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    const data = raw.map(flattenCategories)
    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 } }
  }

  // 每日推荐：从 approved 图片中随机选一张，Redis 缓存到次日 4 点
  async getDailyRecommendation() {
    const cacheKey = 'daily_recommendation'
    // fail-open：Redis 不可用时 cached 为 null，直接走下面的实时查询，不影响接口可用性
    const cached = await this.redisService.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const count = await this.prisma.image.count({
      where: { status: 'approved', section: 'general' },
    })
    if (count === 0) return null

    const skip = Math.floor(Math.random() * count)
    const image = await this.prisma.image.findFirst({
      where: { status: 'approved', section: 'general' },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        url: true,
        likeCount: true,
        user: { select: { id: true, username: true } },
      },
      skip,
      orderBy: { createdAt: 'desc' },
    })

    if (!image) return null

    // 计算到次日凌晨 4 点的秒数
    const now = new Date()
    const next4am = new Date(now)
    next4am.setDate(next4am.getDate() + 1)
    next4am.setHours(4, 0, 0, 0)
    const ttl = Math.floor((next4am.getTime() - now.getTime()) / 1000)

    // 写缓存失败不影响返回结果（下次请求重算即可）
    await this.redisService.set(cacheKey, JSON.stringify(image), ttl)
    return image
  }

  // 每周排行榜：按点赞数排名，过去 7 天的 approved 图片
  async getLeaderboard(limit = 10) {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const images = await this.prisma.image.findMany({
      where: {
        status: 'approved',
        section: 'general',
        createdAt: { gte: weekAgo },
      },
      select: {
        id: true,
        title: true,
        likeCount: true,
        thumbnailUrl: true,
        url: true,
        user: { select: { id: true, username: true } },
      },
      orderBy: { likeCount: 'desc' },
      take: limit,
    })

    return images
  }

  // 供内部使用的原始查询，不做状态过滤和扁平化
  async findByIdRaw(id: string) {
    return this.prisma.image.findUnique({ where: { id } })
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    })
  }
}
