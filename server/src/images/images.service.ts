import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'

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
    const { page = 1, size = 20, category, search, sort = 'latest' } = params

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

    const [data, total] = await Promise.all([
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

    return {
      data,
      meta: { page, size, total, totalPages: Math.ceil(total / size) },
    }
  }

  async findById(id: string, userId?: string) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        categories: { include: { category: true } },
      },
    })
    if (!image) return null

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

    return { ...image, isLiked }
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    })
  }
}
