import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService } from '../minio/minio.service'
import { RedisService } from '../redis/redis.service'
import { ensureTags } from '../common/utils/tags'
import { cleanText } from '../common/utils/text'

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

    const where: any = {}
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
    const [pending, approved, rejected, offline, users, comments, collections, favorites, todayUploads, agg] =
      await Promise.all([
        this.prisma.image.count({ where: { status: 'pending' } }),
        this.prisma.image.count({ where: { status: 'approved' } }),
        this.prisma.image.count({ where: { status: 'rejected' } }),
        this.prisma.image.count({ where: { status: 'offline' } }),
        this.prisma.user.count(),
        this.prisma.comment.count(),
        this.prisma.collection.count(),
        this.prisma.favorite.count(),
        this.prisma.image.count({ where: { createdAt: { gte: today } } }),
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

    const updated = await this.prisma.image.update({
      where: { id },
      data: { status: status as any },
    })
    // 状态变更时清除每日推荐缓存
    await this.redisService.del('daily_recommendation')
    return updated
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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.image.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: cleanText(data.title, 255) } : {}),
          ...(data.description !== undefined
            ? { description: cleanText(data.description, 500) || null }
            : {}),
          ...(data.section !== undefined ? { section: data.section } : {}),
        },
      })

      // 可选：更新图片分类
      if (data.categoryIds !== undefined) {
        const count = await tx.category.count({
          where: { id: { in: data.categoryIds } },
        })
        if (count !== data.categoryIds.length) {
          throw new BadRequestException('存在无效的分类')
        }
        await tx.imagesOnCategories.deleteMany({ where: { imageId: id } })
        if (data.categoryIds.length > 0) {
          await tx.imagesOnCategories.createMany({
            data: data.categoryIds.map((categoryId) => ({ imageId: id, categoryId })),
          })
        }
      }

      if (tagRows) {
        await tx.imageTag.deleteMany({ where: { imageId: id } })
        if (tagRows.length > 0) {
          await tx.imageTag.createMany({
            data: tagRows.map((tag) => ({ imageId: id, tagId: tag.id })),
          })
        }
      }

      return updated
    })
  }

  async deleteImage(id: string) {
    const image = await this.prisma.image.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('图片不存在')

    // 从 MinIO 删除所有关联文件
    const urls = [image.url, image.thumbnailUrl, image.thumbnailSmUrl]
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

    await this.prisma.image.delete({ where: { id } })
    // 删除时清除每日推荐缓存
    await this.redisService.del('daily_recommendation')
    return { message: '删除成功' }
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