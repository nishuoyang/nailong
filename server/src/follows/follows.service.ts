import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

function parsePage(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}
function parseSize(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 50) : 20
}

const userCard = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
  role: true,
  createdAt: true,
} as const

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async toggle(followerId: string, followingId: string) {
    if (followerId === followingId) throw new BadRequestException('不能关注自己')

    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true },
    })
    if (!target) throw new NotFoundException('用户不存在')

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })

    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } })
    } else {
      try {
        await this.prisma.follow.create({ data: { followerId, followingId } })
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err
      }
    }

    const followerCount = await this.prisma.follow.count({ where: { followingId } })
    return { following: !existing, followerCount }
  }

  private async decorateUsers(
    rows: Array<{ follower?: any; following?: any }>,
    viewerId?: string,
  ) {
    const users = rows.map((row) => row.follower ?? row.following).filter(Boolean)
    if (!viewerId || users.length === 0) return users.map((user) => ({ ...user, isFollowing: false }))
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
      select: { followingId: true },
    })
    const set = new Set(follows.map((f) => f.followingId))
    return users.map((user) => ({ ...user, isFollowing: set.has(user.id) }))
  }

  async listFollowers(userId: string, page?: number, size?: number, viewerId?: string) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const where = { followingId: userId }
    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: { follower: { select: userCard } },
      }),
      this.prisma.follow.count({ where }),
    ])
    return {
      data: await this.decorateUsers(rows, viewerId),
      meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 },
    }
  }

  async listFollowing(userId: string, page?: number, size?: number, viewerId?: string) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const where = { followerId: userId }
    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: { following: { select: userCard } },
      }),
      this.prisma.follow.count({ where }),
    ])
    return {
      data: await this.decorateUsers(rows, viewerId),
      meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 },
    }
  }

  async feed(userId: string, page?: number, size?: number) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const where = {
      status: 'approved',
      user: { followers: { some: { followerId: userId } } },
    }

    const [rows, total, followCount] = await Promise.all([
      this.prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.image.count({ where }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ])

    return {
      data: rows.map((image) => ({
        ...image,
        categories: image.categories.map((c) => c.category),
        tags: image.tags.map((t) => t.tag),
      })),
      meta: {
        page: pageNum,
        size: sizeNum,
        total,
        totalPages: Math.ceil(total / sizeNum) || 1,
        followingCount: followCount,
      },
    }
  }
}