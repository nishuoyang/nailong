import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { engagementTargetId } from '../common/utils/batch'

function parsePage(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}
function parseSize(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 50) : 20
}

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async toggle(userId: string, imageId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true, batchId: true, status: true },
    })
    if (!image || image.status !== 'approved') throw new NotFoundException('图片不存在')

    // 收藏整组共用一条：收藏的是这次投稿，而不是其中某一张
    const targetId = await engagementTargetId(this.prisma, image)

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_imageId: { userId, imageId: targetId } },
    })

    if (existing) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.favorite.delete({ where: { id: existing.id } }),
        this.prisma.image.update({
          where: { id: targetId },
          data: { favoriteCount: { decrement: 1 } },
        }),
      ])
      return { favorited: false, favoriteCount: Math.max(0, updated.favoriteCount) }
    }

    try {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.favorite.create({ data: { userId, imageId: targetId } }),
        this.prisma.image.update({
          where: { id: targetId },
          data: { favoriteCount: { increment: 1 } },
        }),
      ])
      return { favorited: true, favoriteCount: updated.favoriteCount }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const current = await this.prisma.image.findUnique({
          where: { id: targetId },
          select: { favoriteCount: true },
        })
        return { favorited: true, favoriteCount: current?.favoriteCount ?? 0 }
      }
      throw err
    }
  }

  async listMine(userId: string, page?: number, size?: number) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const [rows, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: {
          image: {
            include: {
              user: { select: { id: true, username: true, avatarUrl: true } },
              categories: { include: { category: true } },
              tags: { include: { tag: true } },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ])

    const data = rows.map((row) => ({
      ...row.image,
      categories: row.image.categories.map((c) => c.category),
      tags: row.image.tags.map((t) => t.tag),
      favoritedAt: row.createdAt,
      isFavorited: true,
    }))

    return { data, meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 } }
  }
}
