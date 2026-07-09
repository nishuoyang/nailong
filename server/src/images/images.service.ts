import { Injectable, NotFoundException } from '@nestjs/common'
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

@Injectable()
export class ImagesService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async findAll(params: {
    page?: number
    size?: number
    category?: string
    search?: string
    sort?: 'latest' | 'popular' | 'downloads'
  }) {
    const page = Number(params.page) || 1
    const size = Math.min(Number(params.size) || 20, 100)
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

    // 增加浏览次数
    await this.prisma.image.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })

    let isLiked = false
    if (userId) {
      const like = await this.prisma.like.findUnique({
        where: { userId_imageId: { userId, imageId: id } },
      })
      isLiked = !!like
    }

    return flattenCategories({ ...image, isLiked })
  }

  // 其他推荐：section='other' 的 approved 图片
  async getOther(params: { page?: number; size?: number }) {
    const page = Number(params.page) || 1
    const size = Math.min(Number(params.size) || 20, 100)

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
    const page = Number(params.page) || 1
    const size = Math.min(Number(params.size) || 20, 100)

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
    const cached = await this.redisService.client.get(cacheKey)
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

    await this.redisService.client.set(cacheKey, JSON.stringify(image), 'EX', ttl)
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
