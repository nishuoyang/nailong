import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
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
  constructor(private prisma: PrismaService) {}

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
    }

    if (category) {
      where.categories = {
        some: { category: { slug: category } },
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

  // 每周排行榜：按点赞数排名，过去 7 天的 approved 图片
  async getLeaderboard(limit = 10) {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const images = await this.prisma.image.findMany({
      where: {
        status: 'approved',
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
