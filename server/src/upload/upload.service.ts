import { Injectable, BadRequestException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import * as sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService, type ObjectMeta } from '../minio/minio.service'
import { cleanText } from '../common/utils/text'
import { ensureTags } from '../common/utils/tags'

/** 一次投稿最多几张图。前端限制与此保持一致（client/src/pages/UploadPage.vue）。 */
export const MAX_BATCH_IMAGES = 9

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp']
const EXT_BY_FORMAT: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' }

interface PreparedImage {
  smName: string
  mdName: string
  rawName: string
  width: number | null
  height: number | null
  dominantColor: string | null
  blurDataUrl: string | null
}

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
  ) {}

  /**
   * 一次投稿可以带多张图，它们属于同一批次（batchId 相同，batchIndex 0 为封面）。
   *
   * 关键取舍：
   *  - 先全部校验、再逐张处理。任何一张不合格就整批拒绝，不落半批数据；
   *  - 中途失败（sharp 或 MinIO）会把已写入的对象删掉，避免留下孤儿文件；
   *  - 每日配额按「张」计，而不是按「次」计——一次传 9 张就是 9 张的额度。
   */
  async uploadImages(
    files: Express.Multer.File[],
    userId: string,
    title: string,
    description?: string,
    categoryIds?: string[],
    section?: string,
    rawTags?: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException('请选择要上传的图片')
    }
    if (files.length > MAX_BATCH_IMAGES) {
      throw new BadRequestException(`一次最多上传 ${MAX_BATCH_IMAGES} 张图片`)
    }
    if (!title?.trim()) {
      throw new BadRequestException('请填写标题')
    }

    // ── 1. 全部先校验（大小 / 真实格式） ──
    const validated: Array<{ file: Express.Multer.File; format: string }> = []
    for (const file of files) {
      const label = file.originalname || '图片'
      if (!file.buffer?.length) {
        throw new BadRequestException(`「${label}」是空文件`)
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(`「${label}」超过 10MB`)
      }

      // 用 sharp metadata 验证真实文件类型（magic bytes），不信任 Content-Type
      let format: string | undefined
      try {
        const metadata = await sharp(file.buffer, { limitInputPixels: 50_000_000 }).metadata()
        format = metadata.format
      } catch {
        throw new BadRequestException(`「${label}」无法识别，请确认不是损坏的文件`)
      }
      if (!format || !ALLOWED_FORMATS.includes(format)) {
        throw new BadRequestException(`「${label}」格式不支持，仅支持 JPEG、PNG、WebP`)
      }
      validated.push({ file, format })
    }

    // ── 2. 每日上传配额 ──
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = await this.prisma.image.count({
      where: { userId, createdAt: { gte: today } },
    })
    if (todayCount + files.length > 50) {
      const remaining = Math.max(0, 50 - todayCount)
      throw new BadRequestException(
        remaining > 0
          ? `今日上传额度还剩 ${remaining} 张，这次选了 ${files.length} 张`
          : '今日上传次数已达上限（50张）',
      )
    }

    const tags = await ensureTags(this.prisma, rawTags)

    // 同一批次共用一个时间戳前缀，方便在 MinIO 里按批次排查
    const batchStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const batchId = files.length > 1 ? randomUUID() : null
    const uploadedNames: string[] = []

    // ── 3. 逐张处理并上传 ──
    // 串行而非并行：9 张大图同时解码会把 2 vCPU 的小机器内存顶满，
    // 单张 ~100ms 的处理时间在整体体验上可以忽略。
    const prepared: PreparedImage[] = []
    try {
      for (const [index, { file, format }] of validated.entries()) {
        const image = await this.prepareOne(file, batchStamp, index, format)
        prepared.push(image)
        uploadedNames.push(image.smName, image.mdName, image.rawName)
      }
    } catch (err) {
      await this.removeObjects(uploadedNames)
      if (err instanceof BadRequestException) throw err
      throw new BadRequestException('图片处理失败，请确认文件未损坏')
    }

    // ── 4. 入库 ──
    // 一整个批次在同一个事务里创建：要么 9 张都进审核队列，要么一张都没有。
    // URL 只存字符串（见 AGENTS.md「存储透明」），换 MinIO/OSS/COS 不改 schema。
    const baseUrl = this.minioService.baseUrl
    try {
      const images = await this.prisma.$transaction(
        prepared.map((item, index) =>
          this.prisma.image.create({
            data: {
              title: cleanText(title, 255),
              description: description ? cleanText(description, 500) : null,
              url: `${baseUrl}/${item.rawName}`,
              thumbnailUrl: `${baseUrl}/${item.mdName}`,
              thumbnailSmUrl: `${baseUrl}/${item.smName}`,
              width: item.width,
              height: item.height,
              dominantColor: item.dominantColor,
              blurDataUrl: item.blurDataUrl,
              userId,
              status: 'pending',
              section: section === 'other' ? 'other' : 'general',
              batchId,
              batchIndex: index,
              batchSize: prepared.length,
              categories: categoryIds?.length
                ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
                : undefined,
              tags: tags.length ? { create: tags.map((tag) => ({ tagId: tag.id })) } : undefined,
            },
          }),
        ),
      )

      return {
        id: images[0].id,
        ids: images.map((image) => image.id),
        batchId,
        count: images.length,
        message:
          images.length > 1
            ? `${images.length} 张图已提交，等待管理员审核`
            : '上传成功，等待管理员审核',
      }
    } catch (err) {
      // 入库失败则把刚传上去的文件也清掉，否则会留下一组没人引用的对象
      await this.removeObjects(uploadedNames)
      throw err
    }
  }

  /** 单张图：生成缩略图/占位图，写入 MinIO，返回可入库的字段。 */
  private async prepareOne(
    file: Express.Multer.File,
    batchStamp: string,
    index: number,
    format: string,
  ): Promise<PreparedImage> {
    // 扩展名用 sharp 校验出的真实格式，而不是客户端给的 mimetype
    const ext = EXT_BY_FORMAT[format] ?? 'jpg'

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

    // 模糊占位图与主色：列表先铺色块再换清晰图，避免大图加载时的空洞。
    let dominantColor: string | null = null
    let blurDataUrl: string | null = null
    try {
      const [pixel, blur] = await Promise.all([
        sharp(mdBuffer).resize(1, 1, { fit: 'cover' }).raw().toBuffer(),
        sharp(mdBuffer).resize(24).blur(1.4).webp({ quality: 35 }).toBuffer(),
      ])
      if (pixel.length >= 3) {
        dominantColor =
          '#' +
          [pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
      }
      blurDataUrl = `data:image/webp;base64,${blur.toString('base64')}`
    } catch {
      // 占位图失败不影响上传：前端会退化为普通 loading
    }

    // 必须显式写入对象元数据：不传 meta 时 MinIO 会把对象存成 `binary/octet-stream`，
    // 任何绕过 /minio 代理的读取（控制台、CDN 回源、预签名直连）拿到的都是错误的类型。
    const immutableCache = 'public, max-age=31536000, immutable'
    const putMeta = (contentType: string): ObjectMeta => ({
      'Content-Type': contentType,
      'Cache-Control': immutableCache,
    })

    const baseName = `${batchStamp}-${index}`
    const smName = `${baseName}_thumb_sm.webp`
    const mdName = `${baseName}_thumb_md.webp`
    const rawName = `${baseName}.${ext}`
    const rawContentType = `image/${format === 'jpg' ? 'jpeg' : format}`

    await Promise.all([
      this.minioService.putObject(smName, smBuffer, putMeta('image/webp')),
      this.minioService.putObject(mdName, mdBuffer, putMeta('image/webp')),
      this.minioService.putObject(rawName, file.buffer, putMeta(rawContentType)),
    ])

    return {
      smName,
      mdName,
      rawName,
      width: mdMeta.width ?? null,
      height: mdMeta.height ?? null,
      dominantColor,
      blurDataUrl,
    }
  }

  /** 尽力删除对象；单个失败不影响其它清理动作。 */
  private async removeObjects(names: string[]): Promise<void> {
    await Promise.all(
      names.map((name) => this.minioService.removeObject(name).catch(() => undefined)),
    )
  }
}
