import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService } from '../minio/minio.service'
import { RedisService } from '../redis/redis.service'
import { ensureTags } from '../common/utils/tags'
import { cleanText } from '../common/utils/text'
import { PUBLIC_IMAGE_PIVOT_WHERE } from '../common/constants/image-visibility'

function parsePage(page?: number): number {
  const p = Number(page)
  return Number.isFinite(p) && p > 0 ? Math.floor(p) : 1
}
function parseSize(size?: number): number {
  const s = Number(size)
  return Number.isFinite(s) && s > 0 ? Math.min(Math.floor(s), 100) : 20
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
    private redisService: RedisService,
  ) {}

  async findAllImages(params: { page?: number; size?: number; status?: string; search?: string }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)
    const { status, search } = params

    const where: any = {
      // 审核列表按投稿折叠：一次投稿只出现一条（封面），通过/拒绝作用于整批。
      // 存量单图数据 batchIndex 默认 0，不受影响。
      batchIndex: 0,
    }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { user: { username: { contains: search } } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    return {
      data: data.map((image) => ({
        ...image,
        categories: image.categories.map((c) => c.category),
        tags: image.tags.map((t) => t.tag),
      })),
      meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 },
    }
  }

  async stats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [pending, approved, rejected, offline, users, comments, collections, favorites, todayUploads, memePending, agg] =
      await Promise.all([
        // 统计口径与列表一致：都以「投稿批次」为单位（封面那张），
        // 否则待审核数是 9、点进去只有 1 条，对不上。
        this.prisma.image.count({ where: { status: 'pending', batchIndex: 0 } }),
        this.prisma.image.count({ where: { status: 'approved', batchIndex: 0 } }),
        this.prisma.image.count({ where: { status: 'rejected', batchIndex: 0 } }),
        this.prisma.image.count({ where: { status: 'offline', batchIndex: 0 } }),
        this.prisma.user.count(),
        this.prisma.comment.count(),
        this.prisma.collection.count(),
        this.prisma.favorite.count(),
        this.prisma.image.count({ where: { createdAt: { gte: today }, batchIndex: 0 } }),
        this.prisma.meme.count({ where: { status: 'pending' } }),
        this.prisma.image.aggregate({
          _sum: { likeCount: true, viewCount: true, downloadCount: true },
        }),
      ])

    return {
      pending,
      approved,
      rejected,
      offline,
      users,
      comments,
      collections,
      favorites,
      todayUploads,
      memePending,
      likes: agg._sum.likeCount ?? 0,
      views: agg._sum.viewCount ?? 0,
      downloads: agg._sum.downloadCount ?? 0,
    }
  }

  async listComments(params: { page?: number; size?: number; search?: string }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)
    const where = params.search
      ? {
          OR: [
            { content: { contains: params.search } },
            { user: { username: { contains: params.search } } },
            { image: { title: { contains: params.search } } },
          ],
        }
      : undefined
    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          image: { select: { id: true, title: true, thumbnailSmUrl: true, thumbnailUrl: true } },
        },
      }),
      this.prisma.comment.count({ where }),
    ])
    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 } }
  }

  async deleteComment(id: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } })
    if (!comment) throw new NotFoundException('评论不存在或已被删除')
    await this.prisma.$transaction([
      this.prisma.comment.delete({ where: { id } }),
      this.prisma.image.updateMany({
        where: { id: comment.imageId, commentCount: { gt: 0 } },
        data: { commentCount: { decrement: 1 } },
      }),
    ])
    return { id, deleted: true }
  }

  async updateImageStatus(id: string, status: string) {
    const validStatuses = ['pending', 'approved', 'rejected', 'offline']
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('无效的状态值')
    }

    const image = await this.prisma.image.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('图片不存在')

    // 强制状态机转换规则
    const allowedTransitions: Record<string, string[]> = {
      pending: ['approved', 'rejected'],
      approved: ['offline'],
      rejected: [],
      offline: ['approved'], // 下架后可重新上架
    }

    const allowed = allowedTransitions[image.status]
    if (!allowed || !allowed.includes(status)) {
      throw new BadRequestException(
        `不允许从 "${image.status}" 转换为 "${status}"`,
      )
    }

    // 一次投稿是一个整体：审核/上下架作用于整批，否则会出现
    // 「封面通过了、同批第 2 张还在待审」这种自相矛盾的状态。
    const updated = await this.prisma.image.updateMany({
      where: image.batchId
        ? { batchId: image.batchId, status: image.status }
        : { id, status: image.status },
      data: { status: status as any },
    })
    // 状态变更时清除每日推荐缓存
    await this.redisService.del('daily_recommendation')
    return { id, status, affected: updated.count }
  }

  async toggleFeatured(id: string) {
    const image = await this.prisma.image.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('图片不存在')

    // 用当前值作为条件执行原子切换，避免竞态
    const updated = await this.prisma.image.update({
      where: { id, isFeatured: image.isFeatured },
      data: { isFeatured: !image.isFeatured },
    })
    return { isFeatured: updated.isFeatured }
  }

  async updateImage(
    id: string,
    data: {
      title?: string
      description?: string
      categoryIds?: string[]
      tagNames?: string[]
      section?: string
    },
  ) {
    const image = await this.prisma.image.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('图片不存在')

    if (data.title !== undefined && !data.title.trim()) {
      throw new BadRequestException('标题不能为空')
    }
    if (data.section !== undefined && !['general', 'other'].includes(data.section)) {
      throw new BadRequestException('无效的板块')
    }

    // Resolve tags before opening the transaction: tag creation may hit its own
    // unique constraints and is safe to run idempotently.
    const tagRows = data.tagNames !== undefined ? await ensureTags(this.prisma, data.tagNames) : null

    // 同一批次的图共享标题/描述/分类/标签/板块，编辑一次要整批同步，
    // 否则详情页左右翻动时右侧信息会突然变一套。
    const siblingIds = image.batchId
      ? (
          await this.prisma.image.findMany({
            where: { batchId: image.batchId },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [id]
    const otherIds = siblingIds.filter((sid) => sid !== id)

    return this.prisma.$transaction(async (tx) => {
      const scalarData = {
        ...(data.title !== undefined ? { title: cleanText(data.title, 255) } : {}),
        ...(data.description !== undefined
          ? { description: cleanText(data.description, 500) || null }
          : {}),
        ...(data.section !== undefined ? { section: data.section } : {}),
      }

      const updated = await tx.image.update({
        where: { id },
        data: scalarData,
      })
      if (otherIds.length) {
        await tx.image.updateMany({ where: { id: { in: otherIds } }, data: scalarData })
      }

      // 可选：更新图片分类
      if (data.categoryIds !== undefined) {
        const count = await tx.category.count({
          where: { id: { in: data.categoryIds } },
        })
        if (count !== data.categoryIds.length) {
          throw new BadRequestException('存在无效的分类')
        }
        await tx.imagesOnCategories.deleteMany({ where: { imageId: { in: siblingIds } } })
        if (data.categoryIds.length > 0) {
          await tx.imagesOnCategories.createMany({
            data: siblingIds.flatMap((imageId) =>
              data.categoryIds!.map((categoryId) => ({ imageId, categoryId })),
            ),
          })
        }
      }

      if (tagRows) {
        await tx.imageTag.deleteMany({ where: { imageId: { in: siblingIds } } })
        if (tagRows.length > 0) {
          await tx.imageTag.createMany({
            data: siblingIds.flatMap((imageId) =>
              tagRows.map((tag) => ({ imageId, tagId: tag.id })),
            ),
          })
        }
      }

      return updated
    })
  }

  async deleteImage(id: string) {
    const image = await this.prisma.image.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('图片不存在')

    // 一次投稿整批删除：只删其中一张会留下「封面没了、其余还在」的残批次，
    // 而且列表按 batchIndex=0 折叠后就再也看不到剩下的图。
    const targets = image.batchId
      ? await this.prisma.image.findMany({
          where: { batchId: image.batchId },
          select: { url: true, thumbnailUrl: true, thumbnailSmUrl: true },
        })
      : [image]

    // 从 MinIO 删除所有关联文件
    for (const target of targets) {
      const urls = [target.url, target.thumbnailUrl, target.thumbnailSmUrl]
      for (const url of urls) {
        if (!url) continue
        try {
          const parts = url.split('/')
          const filename = parts[parts.length - 1]
          if (filename) {
            await this.minioService.removeObject(filename)
          }
        } catch {
          // MinIO 删除失败不阻塞数据库删除
        }
      }
    }

    await this.prisma.image.deleteMany({
      where: image.batchId ? { batchId: image.batchId } : { id },
    })
    // 删除时清除每日推荐缓存
    await this.redisService.del('daily_recommendation')
    return { message: targets.length > 1 ? `已删除 ${targets.length} 张` : '删除成功' }
  }

  // ────────────────────────── 表情包审核（大肥鱼鱼塘）──────────────────────────

  async findAllMemes(params: { page?: number; size?: number; status?: string; search?: string }) {
    const page = parsePage(params.page)
    const size = parseSize(params.size)
    const { status, search } = params

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { note: { contains: search } },
        { code: { contains: search } },
        { user: { username: { contains: search } } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.meme.findMany({
        where,
        include: { user: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.meme.count({ where }),
    ])

    return {
      data: data.map((meme) => ({ ...meme, tags: meme.tags ? meme.tags.split(',') : [] })),
      meta: { page, size, total, totalPages: Math.ceil(total / size) || 1 },
    }
  }

  /**
   * 表情包状态机，与图片一致：
   * pending → approved/rejected；approved → offline（下架）；offline → approved（重新上架）。
   */
  async updateMemeStatus(id: string, status: string) {
    const validStatuses = ['pending', 'approved', 'rejected', 'offline']
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('无效的状态值')
    }

    const meme = await this.prisma.meme.findUnique({ where: { id } })
    if (!meme) throw new NotFoundException('表情包不存在')

    const allowedTransitions: Record<string, string[]> = {
      pending: ['approved', 'rejected'],
      approved: ['offline'],
      rejected: [],
      offline: ['approved'],
    }
    const allowed = allowedTransitions[meme.status]
    if (!allowed || !allowed.includes(status)) {
      throw new BadRequestException(`不允许从 "${meme.status}" 转换为 "${status}"`)
    }

    return this.prisma.meme.update({ where: { id }, data: { status } })
  }

  /** 删除表情包：用户投喂的连带清 MinIO 对象；合集归档指向客户端静态资源，不动文件。 */
  async deleteMeme(id: string) {
    const meme = await this.prisma.meme.findUnique({ where: { id } })
    if (!meme) throw new NotFoundException('表情包不存在')

    if (meme.source === 'user') {
      try {
        const filename = meme.url.split('/').pop()
        if (filename) await this.minioService.removeObject(filename)
      } catch {
        // MinIO 删除失败不阻塞数据库删除（与 deleteImage 同策略）
      }
    }

    await this.prisma.meme.delete({ where: { id } })
    return { message: '删除成功' }
  }

  /**
   * 后台分类列表：同时给出「公开可见数」和「全量关联数」。
   *
   * 公开数用于对齐发现页筛选条；全量数包含待审核 / 已下架 / 其他推荐的图片，
   * 与 deleteCategory 的拦截条件一致。两者分开显示，才不会出现
   * 「页面上写 0 张，删除却提示还有 3 张」。
   */
  async listCategories() {
    const [rows, totalCounts, publicCounts] = await Promise.all([
      this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.imagesOnCategories.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
      }),
      this.prisma.imagesOnCategories.groupBy({
        by: ['categoryId'],
        where: PUBLIC_IMAGE_PIVOT_WHERE,
        _count: { _all: true },
      }),
    ])

    const totalMap = new Map(totalCounts.map((row) => [row.categoryId, row._count._all]))
    const publicMap = new Map(publicCounts.map((row) => [row.categoryId, row._count._all]))

    return rows.map((category) => ({
      ...category,
      count: publicMap.get(category.id) ?? 0,
      totalCount: totalMap.get(category.id) ?? 0,
    }))
  }

  async createCategory(data: { name: string; slug: string; description?: string }) {
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    })
    if (existing) {
      throw new BadRequestException('分类名称或 slug 已存在')
    }
    return this.prisma.category.create({ data })
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
    const category = await this.prisma.category.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('分类不存在')
    return this.prisma.category.update({ where: { id }, data })
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('分类不存在')

    const count = await this.prisma.imagesOnCategories.count({
      where: { categoryId: id },
    })
    if (count > 0) {
      throw new BadRequestException(`该分类下有 ${count} 张图片，请先移除关联`)
    }

    await this.prisma.category.delete({ where: { id } })
    return { message: '删除成功' }
  }
}