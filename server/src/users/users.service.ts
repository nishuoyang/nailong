import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
      data: { bio, bioStatus },
      select: {
        id: true,
        username: true,
        bio: true,
        bioStatus: true,
      },
    })
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
    const [data, total] = await Promise.all([
      this.prisma.image.findMany({
        where: { userId },
        include: {
          categories: { include: { category: true } },
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where: { userId } }),
    ])
    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) } }
  }
}
