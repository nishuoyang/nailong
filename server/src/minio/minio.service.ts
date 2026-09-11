import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'

/**
 * MinIO / S3 的对象元数据。
 *
 * 只有 `Content-Type`、`Cache-Control`、`Content-Disposition` 等少数几个键会被当作真正的
 * HTTP 头（minio SDK 的 isSupportedHeader 白名单，见 node_modules/minio/dist/main/internal/helper.js），
 * 其余键会被自动加上 `X-Amz-Meta-` 前缀变成「用户自定义元数据」，**不会**影响 Content-Type。
 * 也就是说：写成 `contentType` / `contenttype` 都不会生效，必须精确写 `Content-Type`。
 */
export type ObjectMeta = Record<string, string>

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name)
  private client: Minio.Client
  private bucketName: string

  /**
   * 未配置 MINIO_PUBLIC_URL 时的兜底值。
   *
   * ⚠️ 这里**不能**回退成 `http://{MINIO_ENDPOINT}:{MINIO_PORT}/{bucket}`：
   * 那个地址会被**永久写进数据库**，而它同时满足两点「必然打不开」：
   *   1. 生产环境 MINIO_ENDPOINT=minio 是 Docker 内网主机名，浏览器解析不了；
   *   2. 开发环境是 http://localhost:9000，但服务端 CSP 是 `img-src 'self' data:`，会被拦截。
   * `/minio` 是同源代理路径（main.ts 里注册的中间件），开发（配了 Vite proxy）与生产都可用，
   * 所以它才是安全兜底。少配一个环境变量不该导致数据被写坏。
   */
  private static readonly DEFAULT_PUBLIC_URL = '/minio'

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
    // 启动时把「图片 URL 会以什么前缀落库」明确打出来。
    // 这一行看起来不起眼，但它能在发布后第一眼发现配置写错，
    // 而不是等用户反馈「图片全是坏图」再回头查数据库。
    if (!this.configService.get<string>('MINIO_PUBLIC_URL')) {
      this.logger.warn(
        `未配置 MINIO_PUBLIC_URL，图片 URL 将回退为 ${MinioService.DEFAULT_PUBLIC_URL}（同源代理）。` +
          `建议显式配置该变量。`,
      )
    }
    this.logger.log(`图片 URL 前缀：${this.baseUrl}`)

    await this.ensureBucket()
  }

  get bucket(): string {
    return this.bucketName
  }

  get baseUrl(): string {
    // MINIO_PUBLIC_URL 用于浏览器可访问的图片 URL（开发/生产都应设为 /minio，走同源代理）
    const publicUrl = this.configService.get<string>('MINIO_PUBLIC_URL')?.trim()
    const base = publicUrl || MinioService.DEFAULT_PUBLIC_URL
    return base.endsWith('/') ? `${base}${this.bucketName}` : `${base}/${this.bucketName}`
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

  /**
   * 上传对象。
   *
   * `meta` 会被当作真实的 HTTP 头发给 MinIO（单次 PUT 直接作为请求头；
   * 大文件走分片上传时作为 initiateMultipartUpload 的参数），因此**必须**传
   * `Content-Type`，否则对象会以 `binary/octet-stream` 存下来。
   *
   * 元数据类型定义为 `Record<string, string>` 而不是 `Record<string, unknown>`：
   * metaData 里混入数字/对象不会报错，但会被序列化成 `[object Object]` 之类写进去。
   */
  async putObject(objectName: string, buffer: Buffer, meta?: ObjectMeta) {
    return this.client.putObject(this.bucketName, objectName, buffer, undefined, meta)
  }

  async removeObject(objectName: string) {
    return this.client.removeObject(this.bucketName, objectName)
  }

  async getObject(objectName: string) {
    return this.client.getObject(this.bucketName, objectName)
  }

  /**
   * 从指定 bucket 获取对象（MinIO 代理使用）
   *
   * ⚠️ minio 客户端的 `getObject()` **不支持** offset/length —— 它内部固定以
   * `getPartialObject(bucket, name, 0, 0, ...)` 调用，多传的 getOpts 只用于 versionId。
   * 要读取对象的某个片段（Range 请求）必须直接调用 `getPartialObject()`。
   */
  async getObjectFromBucket(bucket: string, objectName: string, offset?: number, length?: number) {
    if (offset !== undefined) {
      return this.client.getPartialObject(bucket, objectName, offset, length)
    }
    return this.client.getObject(bucket, objectName)
  }

  /** 获取对象元数据 */
  async statObject(bucket: string, objectName: string) {
    return this.client.statObject(bucket, objectName)
  }
}
