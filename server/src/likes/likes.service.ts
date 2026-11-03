import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { engagementTargetId } from '../common/utils/batch'

const MAX_DOWNLOADS_PER_DAY = 200

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  async toggleLike(userId: string, imageId: string) {
    const image = await this.prisma.image.findUnique({ where: { id: imageId } })
    if (!image) throw new NotFoundException('图片不存在')

    // 整组共用一个赞：无论从哪一张点进来，都记在封面那一行
    const targetId = await engagementTargetId(this.prisma, image)

    const existing = await this.prisma.like.findUnique({
      where: { userId_imageId: { userId, imageId: targetId } },
    })

    if (existing) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.like.delete({ where: { id: existing.id } }),
        this.prisma.image.update({
          where: { id: targetId },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
      return { liked: false, likeCount: updated.likeCount }
    } else {
      try {
        const [, updated] = await this.prisma.$transaction([
          this.prisma.like.create({ data: { userId, imageId: targetId } }),
          this.prisma.image.update({
            where: { id: targetId },
            data: { likeCount: { increment: 1 } },
          }),
        ])
        return { liked: true, likeCount: updated.likeCount }
      } catch (err: any) {
        // 竞态：另一个并发请求已创建了点赞记录
        if (err?.code === 'P2002') {
          const updated = await this.prisma.image.findUnique({ where: { id: targetId } })
          return { liked: true, likeCount: updated?.likeCount ?? image.likeCount }
        }
        throw err
      }
    }
  }

  async handleDownload(userId: string, imageId: string) {
    // 每用户每日下载限制
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayDownloads = await this.prisma.download.count({
      where: { userId, createdAt: { gte: today } },
    })
    if (todayDownloads >= MAX_DOWNLOADS_PER_DAY) {
      throw new BadRequestException('今日下载次数已达上限')
    }

    const image = await this.prisma.image.findUnique({ where: { id: imageId } })
    if (!image) throw new NotFoundException('图片不存在')

    if (image.status !== 'approved') {
      throw new NotFoundException('图片不可下载')
    }

    // 下载的仍然是当前这一张的原图，但计数算整组的
    const targetId = await engagementTargetId(this.prisma, image)

    const [, updated] = await this.prisma.$transaction([
      this.prisma.download.create({ data: { userId, imageId: targetId } }),
      this.prisma.image.update({
        where: { id: targetId },
        data: { downloadCount: { increment: 1 } },
      }),
    ])

    return { url: image.url, downloadCount: updated.downloadCount }
  }
}
