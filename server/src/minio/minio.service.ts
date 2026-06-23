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
      port: this.configService.get<number>('MINIO_PORT', 9000),
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
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost')
    const port = this.configService.get<number>('MINIO_PORT', 9000)
    return `http://${endpoint}:${port}/${this.bucketName}`
  }

  async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucketName)
      if (!exists) {
        await this.client.makeBucket(this.bucketName)
        this.logger.log(`Bucket "${this.bucketName}" created`)
      }
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
}
