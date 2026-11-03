import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService, type ObjectMeta } from '../minio/minio.service'
import { RedisService } from '../redis/redis.service'

/**
 * 头像上传限制。
 *
 * 与「投稿图片」（≤10MB、原图另存）刻意不同：头像只用于展示，
 * 会被裁成正方形缩到 512px，所以：
 *  - 上传体积上限压到 2MB（超出的一律拒绝，不静默截断）；
 *  - 服务端统一重编码为 WebP，原图不落盘（省存储、避免 EXIF 泄露）；
 *  - 最短边至少 128px（太小的图放大后必然糊）。
 *
 * ⚠️ 这几个常量必须与前端 `client/src/utils/avatar.ts` 保持一致，
 * 前端先拦一道、后端再验一遍（前端校验只是为了体验，后端才是权威）。
 */
export const AVATAR_MAX_SIZE = 2 * 1024 * 1024
export const AVATAR_MIN_EDGE = 128
export const AVATAR_MAX_EDGE = 4096
/** 存储尺寸上限（正方形） */
export const AVATAR_OUTPUT_SIZE = 512

/** 允许的真实图片格式（由 sharp 读 magic bytes 判定，不信客户端 Content-Type） */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

/** 每小时最多改几次头像，防止有人拿这个接口反复刷 CPU / 堆垃圾对象 */
const AVATAR_HOURLY_LIMIT = 20

/** MinIO 对象名前缀：删除旧头像时靠它识别「这是头像对象，不是站点其它图片」 */
const AVATAR_OBJECT_PREFIX = 'avatar-'

/**
 * 客户端指定的取景框（原图坐标，单位：像素）。
 *
 * 前端画布让用户拖动/缩放决定截哪一块，然后把取景框一起传上来，
 * 服务端据此精确裁剪 —— 这样「预览里看到的」和「最终存下来的」是同一块像素。
 */
export interface AvatarCrop {
  x: number
  y: number
  size: number
}

/**
 * 解析并校验前端传来的取景框。
 *
 * ⚠️ 这些数字完全来自客户端，**必须当作不可信输入**：
 * 越界、非整数、超出原图都会被夹回合法范围，夹不回来就当作没传（走自动裁剪）。
 *
 * 坐标系说明：前端浏览器里的 `naturalWidth/Height` 已经是**按 EXIF 方向纠正后**的尺寸
 * （实测 Chrome 会把 orientation 5~8 的图宽高互换），
 * 所以这里必须用同样的换算，否则取景框会落到别的位置上去。
 */
export function parseCrop(
  raw: { cropX?: unknown; cropY?: unknown; cropSize?: unknown },
  width: number,
  height: number,
  orientation?: number,
): AvatarCrop | null {
  const nums = [raw.cropX, raw.cropY, raw.cropSize].map((v) => Number(v))
  if (nums.some((n) => !Number.isFinite(n))) return null

  // EXIF 方向 5~8 会让宽高互换，与浏览器保持一致
  const swaps = orientation !== undefined && orientation >= 5 && orientation <= 8
  const rotatedW = swaps ? height : width
  const rotatedH = swaps ? width : height

  const size = Math.round(nums[2])
  const x = Math.round(nums[0])
  const y = Math.round(nums[1])
  if (size <= 0 || x < 0 || y < 0) return null
  // 取景框必须完整落在（旋转后的）原图里
  if (x + size > rotatedW || y + size > rotatedH) return null
  return { x, y, size }
}


@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name)

  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
    private redis: RedisService,
  ) {}

  /**
   * 上传头像：校验 → 按取景框裁剪 → 存 MinIO → 写 User.avatarUrl → 删旧头像。
   *
   * 只允许改自己的头像（userId 来自 JWT，不接受请求体传入）。
   *
   * `rawCrop` 是前端画布传来的取景框原始字段（可能为空或非法），
   * 在这里用 sharp 读到的真实尺寸与 EXIF 方向做校验 —— 解析必须放在这里，
   * 因为只有 metadata 才知道原图多大、方向是什么。
   */
  async upload(
    file: Express.Multer.File,
    userId: string,
    rawCrop?: { cropX?: unknown; cropY?: unknown; cropSize?: unknown } | null,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的头像图片')
    if (file.size > AVATAR_MAX_SIZE) {
      throw new BadRequestException('头像文件不能超过 2MB')
    }

    // 用 sharp metadata 验证真实文件类型（magic bytes），不信任 Content-Type
    let metadata: sharp.Metadata
    try {
      metadata = await sharp(file.buffer, { limitInputPixels: 50_000_000 }).metadata()
    } catch {
      throw new BadRequestException('无法识别的图片格式')
    }
    const format = metadata.format ?? ''
    if (!ALLOWED_FORMATS.has(format)) {
      throw new BadRequestException('仅支持 JPEG、PNG、WebP 格式')
    }

    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    if (width < AVATAR_MIN_EDGE || height < AVATAR_MIN_EDGE) {
      throw new BadRequestException(`头像太小了（宽高至少 ${AVATAR_MIN_EDGE}px）`)
    }
    if (width > AVATAR_MAX_EDGE || height > AVATAR_MAX_EDGE) {
      throw new BadRequestException(`头像太大了（宽高不超过 ${AVATAR_MAX_EDGE}px）`)
    }

    const crop = rawCrop ? parseCrop(rawCrop, width, height, metadata.orientation) : null

    await this.assertWithinHourlyLimit(userId)

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    })
    if (!user) throw new NotFoundException('用户不存在')

    const buffer = await this.render(file.buffer, width, height, crop)

    // 对象名内含 userId 与随机串，内容永不覆盖 —— 可以用 immutable 强缓存一年
    const name = `${AVATAR_OBJECT_PREFIX}${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`
    const putMeta: ObjectMeta = {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    await this.minioService.putObject(name, buffer, putMeta)

    const avatarUrl = `${this.minioService.baseUrl}/${name}`
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } })

    // 旧头像在**数据库更新之后**才删：万一删失败，新头像依然已经生效，
    // 最多留一个孤儿对象，不会出现「头像指向已被删掉的文件」。
    await this.removeStoredAvatar(user.avatarUrl, userId)

    return { avatarUrl, url: avatarUrl }
  }

  /**
   * 恢复默认头像：把 avatarUrl 置空（前端回落到默认头像图），并删掉旧文件。
   */
  async remove(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    })
    if (!user) throw new NotFoundException('用户不存在')

    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } })
    await this.removeStoredAvatar(user.avatarUrl, userId)

    return { avatarUrl: null, url: null }
  }

  /**
   * 渲染成正方形头像。
   *
   * 三件事：
   *  1. `.rotate()` 按 EXIF 方向自动纠正，否则手机竖拍照片会显示成横躺；
   *  2. 裁成正方形：
   *     - 有取景框（用户在画布上拖出来的）→ **精确按取景框裁**，
   *       这样前端预览里看到的和最终存下来的就是同一块像素；
   *     - 没有取景框（老客户端 / 直接调接口）→ 退回「注意力」策略
   *       （人像通常不在正中），失败再退回居中；
   *  3. 输出 WebP：同画质下比 JPEG 小一半以上。
   *
   * 目标边长取 min(512, 裁剪区边长)：小图**不放大**，免得 128px 的图硬拉到 512px 糊成一团。
   *
   * ⚠️ 顺序很关键：`.rotate()` 必须在 `.extract()` **之前**，
   * 因为取景框坐标是「旋转后」的坐标系（与浏览器一致）。
   */
  private async render(
    buffer: Buffer,
    width: number,
    height: number,
    crop: AvatarCrop | null,
  ): Promise<Buffer> {
    const make = () => sharp(buffer, { limitInputPixels: 50_000_000 }).rotate()

    if (crop) {
      const target = Math.min(AVATAR_OUTPUT_SIZE, crop.size)
      return await make()
        .extract({ left: crop.x, top: crop.y, width: crop.size, height: crop.size })
        .resize(target, target, { fit: 'fill' })
        .webp({ quality: 88 })
        .toBuffer()
    }

    const target = Math.min(AVATAR_OUTPUT_SIZE, Math.max(width, height))

    if (width !== height) {
      try {
        return await make()
          .resize(target, target, { fit: 'cover', position: sharp.strategy.attention })
          .webp({ quality: 88 })
          .toBuffer()
      } catch {
        // attention 策略对个别图片会失败（例如退化图像），退回居中裁剪
        this.logger.warn('注意力裁剪失败，改用居中裁剪')
      }
    }

    return make()
      .resize(target, target, { fit: 'cover', position: 'centre' })
      .webp({ quality: 88 })
      .toBuffer()
  }

  /**
   * 删除 MinIO 上的旧头像对象。
   *
   * ⚠️ 只删「自己命名空间」里的对象：文件名必须以 avatar- 开头且包含该用户 id。
   * 否则一个被篡改/写错的 avatarUrl 可能让我们删掉站点上的任意一张图片。
   * 删除失败只记日志，不影响主流程。
   */
  private async removeStoredAvatar(previousUrl: string | null, userId: string): Promise<void> {
    if (!previousUrl) return
    const name = previousUrl.split('/').pop()
    if (!name || !name.startsWith(AVATAR_OBJECT_PREFIX) || !name.includes(userId)) return

    try {
      await this.minioService.removeObject(name)
    } catch (err) {
      this.logger.warn(`删除旧头像失败（可忽略）：${name} ${(err as Error)?.message ?? err}`)
    }
  }

  /**
   * 每小时改头像次数上限。
   *
   * 用 Redis 计数，Redis 不可用时**放行**（fail-open）：
   * 头像是低频操作，为它把整个接口堵死不划算；滥用风险由全局限流兜底。
   */
  private async assertWithinHourlyLimit(userId: string): Promise<void> {
    const key = `avatar:rate:${userId}`
    try {
      const count = await this.redis.client.incr(key)
      if (count === 1) await this.redis.client.expire(key, 3600)
      if (count > AVATAR_HOURLY_LIMIT) {
        throw new BadRequestException(`更换头像太频繁了，一小时内最多 ${AVATAR_HOURLY_LIMIT} 次`)
      }
    } catch (err) {
      // BadRequestException 要原样抛出；其余（Redis 故障）一律放行
      if (err instanceof BadRequestException) throw err
      this.logger.warn(`头像限流检查失败，本次放行：${(err as Error)?.message ?? err}`)
    }
  }
}
