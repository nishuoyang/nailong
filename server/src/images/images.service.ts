import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { Prisma } from '@prisma/client'
import { PUBLIC_IMAGE_PIVOT_WHERE, PUBLIC_IMAGE_WHERE } from '../common/constants/image-visibility'
import { engagementTargetId } from '../common/utils/batch'

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

// 批次浏览去重窗口：同一访客在这段时间内反复切换同组图片只计一次。
// 太短挡不住来回翻看，太长会把「过一会儿再看一次」也算成没看。
const VIEW_DEDUPE_SECONDS = 600

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
    tag?: string
    userId?: string
    search?: string
    sort?: 'latest' | 'popular' | 'downloads' | 'views'
    range?: 'week' | 'month' | 'all'
  }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)
    const { category, tag, userId, search, sort = 'latest', range } = params

    const where: Prisma.ImageWhereInput = { ...PUBLIC_IMAGE_WHERE }

    if (category) {
      where.categories = {
        some: { category: { slug: category } },
      }
    }

    if (tag) {
      where.tags = { some: { tag: { slug: tag } } }
    }

    if (userId) {
      where.userId = userId
    }

    if (range && range !== 'all') {
      const since = new Date()
      since.setDate(since.getDate() - (range === 'week' ? 7 : 30))
      where.createdAt = { gte: since }
    }

    if (search) {
      const q = search.trim()
      // Title first, then description and tag names. Prisma has no relevance
      // ranking on SQLite, so orderBy below stays stable and predictable.
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { tags: { some: { tag: { name: { contains: q } } } } },
      ]
    }

    const orderBy: Prisma.ImageOrderByWithRelationInput =
      sort === 'popular'
        ? { likeCount: 'desc' }
        : sort === 'downloads'
          ? { downloadCount: 'desc' }
          : sort === 'views'
            ? { viewCount: 'desc' }
            : { createdAt: 'desc' }

    const [raw, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
        orderBy,
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    const data = raw.map((image) => ({
      ...flattenCategories(image),
      tags: image.tags.map((t) => t.tag),
    }))

    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 } }
  }

  async findById(
    id: string,
    userId?: string,
    viewer?: { ip?: string; userAgent?: string },
  ) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
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

    // 互动数据整组共用：点赞/评论/收藏/下载/浏览都记在封面那一行，
    // 所以统计值、是否已赞、是否已收藏都要按归属图来读。
    const engagementId = await engagementTargetId(this.prisma, image)
    const counters =
      engagementId === image.id
        ? image
        : (await this.prisma.image.findUnique({
            where: { id: engagementId },
            select: {
              viewCount: true,
              likeCount: true,
              downloadCount: true,
              commentCount: true,
              favoriteCount: true,
            },
          })) ?? image

    // 记一次浏览（同组图片在短窗口内只记一次，见 countViewOnce）
    await this.countViewOnce(image, engagementId, userId, viewer)

    // 同批图片：详情页用它做左右切换。列表只展示封面（batchIndex=0），
    // 非封面图只能从这里取；单图投稿没有 batchId，就退化成只有自己的一条。
    const batchRows = image.batchId
      ? await this.prisma.image.findMany({
          where: {
            batchId: image.batchId,
            // 整批的状态是同步变更的；这里再过滤一次 approved，是为了兜住
            // 管理员单独下架某一张的历史数据，别让下架图从详情页漏出去。
            ...(image.status === 'approved' ? { status: 'approved' } : {}),
          },
          orderBy: [{ batchIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            thumbnailUrl: true,
            thumbnailSmUrl: true,
            width: true,
            height: true,
            blurDataUrl: true,
            dominantColor: true,
          },
        })
      : []

    const batchItems = batchRows.length
      ? batchRows
      : [
          {
            id: image.id,
            thumbnailUrl: image.thumbnailUrl,
            thumbnailSmUrl: image.thumbnailSmUrl,
            width: image.width,
            height: image.height,
            blurDataUrl: image.blurDataUrl,
            dominantColor: image.dominantColor,
          },
        ]
    const batchIndex = Math.max(
      0,
      batchItems.findIndex((item) => item.id === image.id),
    )

    let isLiked = false
    let isFavorited = false
    if (userId) {
      const [like, favorite] = await Promise.all([
        this.prisma.like.findUnique({
          where: { userId_imageId: { userId, imageId: engagementId } },
        }),
        this.prisma.favorite.findUnique({
          where: { userId_imageId: { userId, imageId: engagementId } },
        }),
      ])
      isLiked = !!like
      isFavorited = !!favorite
    }

    // 展示数 = 已落库值 + 尚未回写的增量。回写完成（哈希被清）后增量自然归零，
    // 长时间不刷新页面也不会看到虚高。
    const pending = await this.redisService.hget(VIEW_COUNT_HASH, engagementId)
    const viewCount = counters.viewCount + (pending ? Number(pending) : 0)
    return {
      ...flattenCategories(image),
      tags: image.tags.map((t) => t.tag),
      // 五个统计值统一取归属图（封面）的，保证整组切图时数字不动
      likeCount: counters.likeCount,
      downloadCount: counters.downloadCount,
      commentCount: counters.commentCount,
      favoriteCount: counters.favoriteCount,
      viewCount,
      isLiked,
      isFavorited,
      // 同批次信息。items 至少包含当前这张，total === 1 表示不是多图投稿。
      batch: {
        id: image.batchId ?? null,
        total: batchItems.length,
        index: batchIndex,
        items: batchItems,
      },
    }
  }

  /**
   * 记一次浏览。**同一访客在 VIEW_DEDUPE_SECONDS 内只记一次**（仅批次图）。
   *
   * 为什么需要去重：批次内左右切换会重新请求详情接口，如果每次 GET 都 +1，
   * 同组两张会各显示一个不同的数字（线上看到 8 / 7），看起来像没做聚合。
   * 用「访客身份 + 归属图」做去重键后，来回翻、刷新都不会重复计数，
   * 换个人打开才会再 +1。
   *
   * 单图投稿保持原有口径（每次 GET 都计），避免悄悄改变全站统计。
   * Redis 不可用时全部 fail-open：get 返回 null → 照常 +1。
   */
  private async countViewOnce(
    image: { batchId: string | null },
    engagementId: string,
    userId?: string,
    viewer?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    if (!image.batchId) {
      await this.redisService.hincrby(VIEW_COUNT_HASH, engagementId, 1)
      return
    }

    const identity = userId ?? (viewer?.ip ? `${viewer.ip}|${viewer.userAgent ?? ''}` : '')
    if (!identity) {
      await this.redisService.hincrby(VIEW_COUNT_HASH, engagementId, 1)
      return
    }

    const digest = createHash('sha1').update(identity).digest('hex').slice(0, 16)
    const seenKey = `view:seen:${engagementId}:${digest}`
    if (await this.redisService.get(seenKey)) return

    // 先占位再计数：两个并发请求最多多记一次，不会出现「两次都没记」
    await this.redisService.set(seenKey, '1', VIEW_DEDUPE_SECONDS)
    await this.redisService.hincrby(VIEW_COUNT_HASH, engagementId, 1)
  }

  /**
   * Related images: shared tags first, then shared categories, then recent.
   * Reads only approved rows; the detail page uses this as a quiet "more like this".
   */
  async related(id: string, limit = 8) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      select: {
        id: true,
        batchId: true,
        section: true,
        categories: { select: { categoryId: true } },
        tags: { select: { tagId: true } },
      },
    })
    if (!image) throw new NotFoundException('图片不存在')

    const categoryIds = image.categories.map((c) => c.categoryId)
    const tagIds = image.tags.map((t) => t.tagId)
    const or: Prisma.ImageWhereInput[] = []
    if (tagIds.length) or.push({ tags: { some: { tagId: { in: tagIds } } } })
    if (categoryIds.length) or.push({ categories: { some: { categoryId: { in: categoryIds } } } })

    // 排除同一批次的其它图：在详情页翻到第 2 张时，不该把同组的封面当成「相关推荐」。
    //
    // ⚠️ 不能只写 `{ batchId: { not: batchId } }`：SQL 里 `NULL <> 'x'` 是 UNKNOWN，
    // 单图投稿（batchId 为 null）会被一起排除 —— 实测相关推荐直接变成 0 条。
    // 必须显式把 null 放回来。
    const exclude: Prisma.ImageWhereInput = image.batchId
      ? { OR: [{ batchId: null }, { batchId: { not: image.batchId } }] }
      : { id: { not: id } }

    const base: Prisma.ImageWhereInput = {
      ...exclude,
      status: 'approved',
      section: image.section,
      // 推荐位只放封面，避免同一批图重复占位
      batchIndex: 0,
      // 标签/分类的 OR 与上面的 exclude 是并列关系，必须放进 AND，
      // 否则同名的第二个 OR 会把 exclude 覆盖掉。
      ...(or.length ? { AND: [{ OR: or }] } : {}),
    }

    let rows = await this.prisma.image.findMany({
      where: base,
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    })

    if (rows.length < limit) {
      const seen = new Set(rows.map((row) => row.id))
      const fallback = await this.prisma.image.findMany({
        where: { ...exclude, status: 'approved', section: image.section, batchIndex: 0 },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      })
      rows = [...rows, ...fallback.filter((row) => !seen.has(row.id))].slice(0, limit)
    }

    return rows.map((row) => ({
      ...flattenCategories(row),
      tags: row.tags.map((t) => t.tag),
    }))
  }

  /** Public counters for the landing page. Cached briefly: they are decorative, not billing. */
  private statsCache: { at: number; value: any } | null = null

  async stats() {
    if (this.statsCache && Date.now() - this.statsCache.at < 30_000) return this.statsCache.value

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [images, users, comments, collections, aggregates, todayUploads] = await Promise.all([
      // 计数口径按投稿批次（封面那张），与列表里能看到的卡片数一致
      this.prisma.image.count({ where: { status: 'approved', batchIndex: 0 } }),
      this.prisma.user.count(),
      this.prisma.comment.count(),
      this.prisma.collection.count({ where: { isPublic: true } }),
      this.prisma.image.aggregate({
        where: { status: 'approved' },
        _sum: { likeCount: true, downloadCount: true, viewCount: true },
      }),
      this.prisma.image.count({ where: { createdAt: { gte: today }, batchIndex: 0 } }),
    ])

    const value = {
      images,
      users,
      comments,
      collections,
      likes: aggregates._sum.likeCount ?? 0,
      downloads: aggregates._sum.downloadCount ?? 0,
      views: aggregates._sum.viewCount ?? 0,
      todayUploads,
    }
    this.statsCache = { at: Date.now(), value }
    return value
  }

  // 其他推荐：section='other' 的 approved 图片
  async getOther(params: { page?: number; size?: number }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)

    const where: Prisma.ImageWhereInput = {
      status: 'approved',
      section: 'other',
      batchIndex: 0,
    }

    const [raw, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    const data = raw.map((image) => ({
      ...flattenCategories(image),
      tags: image.tags.map((t) => t.tag),
    }))
    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 } }
  }

  // 精选推荐：管理员手动标记的 isFeatured 图片
  async getFeatured(params: { page?: number; size?: number }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)

    const where: Prisma.ImageWhereInput = {
      status: 'approved',
      isFeatured: true,
      batchIndex: 0,
    }

    const [raw, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    const data = raw.map((image) => ({
      ...flattenCategories(image),
      tags: image.tags.map((t) => t.tag),
    }))
    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 } }
  }

  // 每日推荐：从 approved 图片中随机选一张，Redis 缓存到次日 4 点
  async getDailyRecommendation() {
    const cacheKey = 'daily_recommendation'
    // fail-open：Redis 不可用时 cached 为 null，直接走下面的实时查询，不影响接口可用性
    const cached = await this.redisService.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const count = await this.prisma.image.count({
      where: { status: 'approved', section: 'general', batchIndex: 0 },
    })
    if (count === 0) return null

    const skip = Math.floor(Math.random() * count)
    const image = await this.prisma.image.findFirst({
      where: { status: 'approved', section: 'general', batchIndex: 0 },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        thumbnailSmUrl: true,
        width: true,
        height: true,
        blurDataUrl: true,
        dominantColor: true,
        likeCount: true,
        commentCount: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
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
  async getLeaderboard(limit = 10, range: 'week' | 'month' | 'all' = 'week') {
    const since = new Date()
    if (range !== 'all') {
      since.setDate(since.getDate() - (range === 'week' ? 7 : 30))
    }

    const images = await this.prisma.image.findMany({
      where: {
        status: 'approved',
        section: 'general',
        batchIndex: 0,
        ...(range === 'all' ? {} : { createdAt: { gte: since } }),
      },
      select: {
        id: true,
        title: true,
        likeCount: true,
        viewCount: true,
        downloadCount: true,
        commentCount: true,
        thumbnailUrl: true,
        thumbnailSmUrl: true,
        blurDataUrl: true,
        dominantColor: true,
        width: true,
        height: true,
        url: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
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

  /**
   * 分类列表与「公开可见图片数」。
   *
   * `_count.images` 必须带 where —— 裸计数会把待审核、已拒绝、已下架以及
   * 其他推荐（section='other'）的图片都算进来，而发现页列表只查
   * `approved + general`，两个口径不一致就会出现「计数 3、列表 0」。
   * 这里与 findAll 共用 PUBLIC_IMAGE_WHERE，保证数字和点进去的结果永远同源。
   */
  async getCategories() {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { images: { where: PUBLIC_IMAGE_PIVOT_WHERE } },
        },
      },
    })
    return rows.map(({ _count, ...category }) => ({ ...category, count: _count.images }))
  }
}