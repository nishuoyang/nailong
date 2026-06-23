import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  async toggleLike(userId: string, imageId: string) {
    const image = await this.prisma.image.findUnique({ where: { id: imageId } })
    if (!image) throw new NotFoundException('图片不存在')

    const existing = await this.prisma.like.findUnique({
      where: { userId_imageId: { userId, imageId } },
    })

    if (existing) {
      // 取消点赞
      const [, updated] = await this.prisma.$transaction([
        this.prisma.like.delete({ where: { id: existing.id } }),
        this.prisma.image.update({
          where: { id: imageId },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
      return { liked: false, likeCount: updated.likeCount }
    } else {
      // 点赞
      const [, updated] = await this.prisma.$transaction([
        this.prisma.like.create({ data: { userId, imageId } }),
        this.prisma.image.update({
          where: { id: imageId },
          data: { likeCount: { increment: 1 } },
        }),
      ])
      return { liked: true, likeCount: updated.likeCount }
    }
  }

  async handleDownload(userId: string, imageId: string) {
    const image = await this.prisma.image.findUnique({ where: { id: imageId } })
    if (!image) throw new NotFoundException('图片不存在')

    // 仅允许下载已审核通过的图片
    if (image.status !== 'approved') {
      throw new NotFoundException('图片不可下载')
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.download.create({ data: { userId, imageId } }),
      this.prisma.image.update({
        where: { id: imageId },
        data: { downloadCount: { increment: 1 } },
      }),
    ])

    return { url: image.url, downloadCount: updated.downloadCount }
  }
}
