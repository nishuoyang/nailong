import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { cleanText } from '../common/utils/text'

function parsePage(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

function parseSize(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 50) : 20
}

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async list(imageId: string, page?: number, size?: number, viewer?: { id: string; role: string }) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true, status: true, userId: true },
    })
    if (!image) throw new NotFoundException('图片不存在')
    if (image.status !== 'approved' && viewer?.role !== 'admin' && viewer?.id !== image.userId) {
      throw new NotFoundException('图片不存在')
    }

    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { imageId },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      }),
      this.prisma.comment.count({ where: { imageId } }),
    ])

    return {
      data: data.map((comment) => ({
        ...comment,
        isOwn: viewer?.id === comment.userId,
        canDelete: viewer?.id === comment.userId || viewer?.role === 'admin',
      })),
      meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 },
    }
  }

  async create(imageId: string, userId: string, rawContent: string) {
    const content = cleanText(rawContent, 500)
    if (!content) throw new NotFoundException('评论内容不能为空')

    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true, status: true },
    })
    if (!image || image.status !== 'approved') throw new NotFoundException('图片不存在')

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { imageId, userId, content },
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      }),
      this.prisma.image.update({
        where: { id: imageId },
        data: { commentCount: { increment: 1 } },
      }),
    ])

    return { ...comment, isOwn: true, canDelete: true }
  }

  async remove(id: string, user: { id: string; role: string }) {
    const comment = await this.prisma.comment.findUnique({ where: { id } })
    if (!comment) throw new NotFoundException('评论不存在或已被删除')
    if (comment.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('只能删除自己的评论')
    }

    await this.prisma.$transaction([
      this.prisma.comment.delete({ where: { id } }),
      this.prisma.image.updateMany({
        where: { id: comment.imageId, commentCount: { gt: 0 } },
        data: { commentCount: { decrement: 1 } },
      }),
    ])

    return { id, deleted: true }
  }
}
