import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import * as sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UploadService {
  private minioClient: Minio.Client
  private bucket: string

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    })
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'nailong-images')
    this.ensureBucket()
  }

  private async ensureBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket)
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket)
      }
    } catch {
      // bucket creation will be handled when MinIO is available
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    userId: string,
    title: string,
    description?: string,
    categoryIds?: string[],
  ) {
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

    const ext = file.mimetype.split('/')[1]
    const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    // 生成缩略图
    const smBuffer = await sharp(file.buffer).resize(300).jpeg({ quality: 80 }).toBuffer()
    const mdBuffer = await sharp(file.buffer).resize(800).jpeg({ quality: 85 }).toBuffer()

    // 上传到 MinIO
    const [smName, mdName, rawName] = [
      `${baseName}_thumb_sm.jpg`,
      `${baseName}_thumb_md.jpg`,
      `${baseName}.${ext}`,
    ]

    await Promise.all([
      this.minioClient.putObject(this.bucket, smName, smBuffer),
      this.minioClient.putObject(this.bucket, mdName, mdBuffer),
      this.minioClient.putObject(this.bucket, rawName, file.buffer),
    ])

    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost')
    const port = this.configService.get<number>('MINIO_PORT', 9000)
    const baseUrl = `http://${endpoint}:${port}/${this.bucket}`

    const image = await this.prisma.image.create({
      data: {
        title,
        description,
        url: `${baseUrl}/${rawName}`,
        thumbnailUrl: `${baseUrl}/${mdName}`,
        userId,
        status: 'pending',
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
