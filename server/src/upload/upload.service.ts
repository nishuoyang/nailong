import { Injectable, BadRequestException } from '@nestjs/common'
import * as sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService, type ObjectMeta } from '../minio/minio.service'

// 简易 HTML 标签去除
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

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
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('文件大小不能超过 10MB')
    }

    // 用 sharp metadata 验证真实文件类型（magic bytes），不信任 Content-Type
    let metadata: sharp.Metadata
    try {
      metadata = await sharp(file.buffer, { limitInputPixels: 50_000_000 }).metadata()
    } catch {
      throw new BadRequestException('无法识别的图片格式')
    }
    const allowedFormats = ['jpeg', 'png', 'webp']
    if (!metadata.format || !allowedFormats.includes(metadata.format)) {
      throw new BadRequestException('仅支持 JPEG、PNG、WebP 格式')
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

    // 扩展名用 sharp 校验出的真实格式，而不是客户端给的 mimetype
    // （mimetype 是客户端声明的，可能与真实内容不符）
    const extByFormat: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' }
    const ext = extByFormat[metadata.format] ?? 'jpg'
    const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    // 生成缩略图（包裹 try-catch 防 corrupt 文件）
    //
    // 相比原实现的三点改动：
    //  1. 原实现是两次独立的 `sharp(file.buffer)`，即同一份输入被完整解码两次且串行执行；
    //     这里改为一次解码 + clone() 派生两个尺寸，并用 Promise.all 并行输出。
    //     （实测 4000x3000 JPEG：132ms -> 111ms，约 1.19x。注意 clone 后若改回串行会更慢，
    //      实测 179ms —— 并行是这里的关键，别把 Promise.all 拆开。）
    //  2. 输出 WebP 替代 JPEG：用站内 10 张真实素材实测，300px 缩略图小 36.6%、
    //     800px 缩略图小 43.1%，且每一张都更小，无例外。
    //  3. .rotate() 无参数时按 EXIF 方向自动纠正，否则手机竖拍照片会显示成横躺；
    //     withoutEnlargement 避免比目标尺寸还小的图被放大。
    let smBuffer: Buffer
    let mdBuffer: Buffer
    let mdMeta: sharp.Metadata
    try {
      const pipeline = sharp(file.buffer, { limitInputPixels: 50_000_000 }).rotate()
      ;[smBuffer, mdBuffer] = await Promise.all([
        pipeline.clone().resize(300, null, { withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
        pipeline.clone().resize(800, null, { withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      ])
      // 显示尺寸 = md 输出缓冲的实际像素（800 宽，withoutEnlargement 时可能是原始宽度）。
      // 读「输出」而不是输入 metadata：输入的不带 .rotate() 的 EXIF 纠正（竖拍图宽高是反的），
      // 读输出则与浏览器最终渲染的宽高比完全一致。见 schema 里 width/height 的语义注释。
      mdMeta = await sharp(mdBuffer).metadata()
    } catch {
      throw new BadRequestException('图片处理失败，请确认文件未损坏')
    }

    // 上传到 MinIO
    //
    // 必须显式写入对象元数据：不传 meta 时 MinIO 会把对象存成 `binary/octet-stream`
    // （线上 33 个存量对象全部如此）。虽然 main.ts 的 /minio 代理现在会按扩展名推断
    // Content-Type 兜住浏览器侧，但**任何绕过代理的读取**（MinIO 控制台、将来接 CDN 回源、
    // 预签名 URL 直连）拿到的都是错误的类型，所以要在数据源头修正。
    //
    // Cache-Control 用 immutable 一年：对象名内含随机串，内容永不覆盖，
    // 与 main.ts 代理里设置的响应头保持一致。
    const immutableCache = 'public, max-age=31536000, immutable'
    const putMeta = (contentType: string): ObjectMeta => ({
      'Content-Type': contentType,
      'Cache-Control': immutableCache,
    })

    const [smName, mdName, rawName] = [
      `${baseName}_thumb_sm.webp`,
      `${baseName}_thumb_md.webp`,
      `${baseName}.${ext}`,
    ]

    // 原图用 sharp 探测出的**真实**格式对应的 MIME，而不是客户端声明的 file.mimetype
    // （mimetype 是客户端可控的，前面已用 sharp 校验过真实格式）
    const rawContentType = `image/${metadata.format === 'jpg' ? 'jpeg' : metadata.format}`

    await Promise.all([
      this.minioService.putObject(smName, smBuffer, putMeta('image/webp')),
      this.minioService.putObject(mdName, mdBuffer, putMeta('image/webp')),
      this.minioService.putObject(rawName, file.buffer, putMeta(rawContentType)),
    ])

    const baseUrl = this.minioService.baseUrl

    const image = await this.prisma.image.create({
      data: {
        title: stripHtml(title),
        description: description ? stripHtml(description) : null,
        url: `${baseUrl}/${rawName}`,
        thumbnailUrl: `${baseUrl}/${mdName}`,
        thumbnailSmUrl: `${baseUrl}/${smName}`,
        width: mdMeta.width ?? null,
        height: mdMeta.height ?? null,
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
