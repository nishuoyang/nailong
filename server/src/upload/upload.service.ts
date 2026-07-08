import { Injectable, BadRequestException } from '@nestjs/common'
import * as sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService } from '../minio/minio.service'

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
  ) {}

  async uploadImage(
    file: Express.Multer.File,
    userId: string,
    title: string,
    description?: string,
    categoryIds?: string[],
    section?: string,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片')
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 JPEG、PNG、WebP 格式')
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('文件大小不能超过 10MB')
    }

    // 检查用户当日上传数量（防滥用）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = await this.prisma.image.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    })
    if (todayCount >= 50) {
      throw new BadRequestException('今日上传次数已达上限（50张）')
    }

    const ext = file.mimetype.split('/')[1] || 'jpg'
    const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    // 生成缩略图（包裹 try-catch 防 corrupt 文件）
    let smBuffer: Buffer
    let mdBuffer: Buffer
    try {
      smBuffer = await sharp(file.buffer).resize(300).jpeg({ quality: 80 }).toBuffer()
      mdBuffer = await sharp(file.buffer).resize(800).jpeg({ quality: 85 }).toBuffer()
    } catch {
      throw new BadRequestException('图片处理失败，请确认文件未损坏')
    }

    // 上传到 MinIO
    const [smName, mdName, rawName] = [
      `${baseName}_thumb_sm.jpg`,
      `${baseName}_thumb_md.jpg`,
      `${baseName}.${ext}`,
    ]

    await Promise.all([
      this.minioService.putObject(smName, smBuffer),
      this.minioService.putObject(mdName, mdBuffer),
      this.minioService.putObject(rawName, file.buffer),
    ])

    const baseUrl = this.minioService.baseUrl

    const image = await this.prisma.image.create({
      data: {
        title,
        description,
        url: `${baseUrl}/${rawName}`,
        thumbnailUrl: `${baseUrl}/${mdName}`,
        thumbnailSmUrl: `${baseUrl}/${smName}`,
        userId,
        status: 'pending',
        section: section === 'other' ? 'other' : 'general',
        categories: categoryIds?.length
          ? {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            }
          : undefined,
      },
      include: {
        categories: { include: { category: true } },
      },
    })

    return { id: image.id, message: '上传成功，等待管理员审核' }
  }
}
