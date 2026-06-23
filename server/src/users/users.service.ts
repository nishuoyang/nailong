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
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException('用户不存在')
    return user
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
    return {
      data,
      meta: { page, size, total, totalPages: Math.ceil(total / size) },
    }
  }
}
