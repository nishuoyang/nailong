import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name)
  private client: Minio.Client
  private bucketName: string

  constructor(private configService: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.configService.get<string>('MINIO_PORT', '9000')),
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    })
    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'nailong-images')
  }

  async onModuleInit() {
    await this.ensureBucket()
  }

  get bucket(): string {
    return this.bucketName
  }

  get baseUrl(): string {
    // MINIO_PUBLIC_URL 用于浏览器可访问的图片 URL（生产环境应设为公网地址）
    const publicUrl = this.configService.get<string>('MINIO_PUBLIC_URL')
    if (publicUrl) {
      return publicUrl.endsWith('/') ? `${publicUrl}${this.bucketName}` : `${publicUrl}/${this.bucketName}`
    }
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost')
    const port = Number(this.configService.get<string>('MINIO_PORT', '9000'))
    return `http://${endpoint}:${port}/${this.bucketName}`
  }

  async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucketName)
      if (!exists) {
        await this.client.makeBucket(this.bucketName)
        this.logger.log(`Bucket "${this.bucketName}" created`)
      }

      // 设置公开读策略，否则浏览器无法直接加载图片
      const publicPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/*`],
          },
        ],
      }
      await this.client.setBucketPolicy(this.bucketName, JSON.stringify(publicPolicy))
      this.logger.log(`Bucket "${this.bucketName}" set to public read`)
    } catch (err) {
      this.logger.error(`Failed to ensure bucket "${this.bucketName}":`, err)
    }
  }

  async putObject(objectName: string, buffer: Buffer, meta?: Record<string, unknown>) {
    return this.client.putObject(this.bucketName, objectName, buffer, undefined, meta)
  }

  async removeObject(objectName: string) {
    return this.client.removeObject(this.bucketName, objectName)
  }

  async getObject(objectName: string) {
    return this.client.getObject(this.bucketName, objectName)
  }
}
