import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

function parsePage(page?: number): number {
  const p = Number(page)
  return Number.isFinite(p) && p > 0 ? Math.floor(p) : 1
}
function parseSize(size?: number): number {
  const s = Number(size)
  return Number.isFinite(s) && s > 0 ? Math.min(Math.floor(s), 100) : 20
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, size = 20) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true, username: true, email: true, role: true,
          avatarUrl: true, bio: true, bioStatus: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      }),
      this.prisma.user.count(),
    ])
    return { data, meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 } }
  }

  async updateUser(id: string, data: { username?: string; email?: string; role?: string; bioStatus?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('用户不存在')
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.username !== undefined && { username: data.username }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.role !== undefined && { role: data.role as any }),
          ...(data.bioStatus !== undefined && { bioStatus: data.bioStatus as any }),
        },
        select: {
        id: true, username: true, email: true, role: true,
        avatarUrl: true, bio: true, bioStatus: true, createdAt: true,
      },
    })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new NotFoundException('邮箱或用户名已被使用')
      }
      throw err
    }
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        bio: true,
        bioStatus: true,
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException('用户不存在')
    return user
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        avatarUrl: true,
        bio: true,
        bioStatus: true,
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException('用户不存在')

    return {
      ...user,
      bio: user.bio && user.bioStatus === 'approved' ? user.bio : '这个人很懒，什么也没留下',
    }
  }

  async updateBio(userId: string, bio: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('用户不存在')

    // bio 修改后需要重新审核（管理员默认通过）
    const bioStatus = user.role === 'admin' ? 'approved' : 'pending'

    return this.prisma.user.update({
      where: { id: userId },
      data: { bio: stripHtml(bio), bioStatus },
      select: {
        id: true,
        username: true,
        bio: true,
        bioStatus: true,
      },
    })
  }

  async getUserImages(userId: string, page = 1, size = 20) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)

    const [data, total] = await Promise.all([
      this.prisma.image.findMany({
        where: { userId, status: 'approved' },
        include: {
          categories: { include: { category: true } },
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      }),
      this.prisma.image.count({ where: { userId, status: 'approved' } }),
    ])
    return { data, meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 } }
  }

  async approveBio(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.bio) throw new NotFoundException('用户或 bio 不存在')

    return this.prisma.user.update({
      where: { id: userId },
      data: { bioStatus: 'approved' },
    })
  }

  async getMyImages(userId: string, page = 1, size = 20) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const [data, total] = await Promise.all([
      this.prisma.image.findMany({
        where: { userId },
        include: {
          categories: { include: { category: true } },
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      }),
      this.prisma.image.count({ where: { userId } }),
    ])
    return { data, meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 } }
  }
}
