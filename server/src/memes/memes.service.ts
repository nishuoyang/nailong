import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common'
import * as sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService, type ObjectMeta } from '../minio/minio.service'
import { cleanText } from '../common/utils/text'

/** 情绪鱼塘取值域，与前端 WhaleMood 保持一致 */
export const MEME_MOODS = ['fish', 'work', 'break', 'night', 'cute'] as const
export type MemeMood = (typeof MEME_MOODS)[number]

/** 表情包上传限制（比图片更严一点：GIF 解码成本高，且表情包场景用不到超大图） */
const MEME_MAX_SIZE = 5 * 1024 * 1024
const MEME_MIN_EDGE = 32
const MEME_MAX_EDGE = 4096
const MEME_DAILY_LIMIT = 20

const EXT_BY_FORMAT: Record<string, string> = { gif: 'gif', png: 'png', webp: 'webp' }
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  gif: 'image/gif',
  png: 'image/png',
  webp: 'image/webp',
}

function isMemeMood(value: string): value is MemeMood {
  return (MEME_MOODS as readonly string[]).includes(value)
}

/** 逗号分隔标签 ↔ 数组（入库用逗号串，出站拆成数组给前端） */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export interface MemeListParams {
  mood?: string
  search?: string
  /** 前端鱼塘是本地筛选/随机抽的交互，一次拉全量（有上限）比翻页体验好 */
  size?: number
}

@Injectable()
export class MemesService {
  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
  ) {}

  private toPublic(row: {
    id: string
    code: string
    title: string
    note: string | null
    mood: string
    tags: string | null
    url: string
    status: string
    source: string
    userId: string
    createdAt: Date
    user?: { id: string; username: string; avatarUrl: string | null } | null
  }) {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      note: row.note,
      mood: row.mood,
      tags: parseTags(row.tags),
      url: row.url,
      status: row.status,
      source: row.source,
      userId: row.userId,
      createdAt: row.createdAt,
      uploader: row.user
        ? { id: row.user.id, username: row.user.username, avatarUrl: row.user.avatarUrl }
        : undefined,
    }
  }

  /** 公开鱼塘：只出 approved，支持情绪筛选与关键词搜索 */
  async findAll(params: MemeListParams) {
    const where: Record<string, unknown> = { status: 'approved' }
    if (params.mood && isMemeMood(params.mood)) where.mood = params.mood
    const term = params.search?.trim()
    if (term) {
      // SQLite 的 contains 默认区分大小写，这里不加 mode（与 images 搜索口径一致）
      where.OR = [
        { title: { contains: term } },
        { note: { contains: term } },
        { tags: { contains: term } },
      ]
    }

    const size = Math.min(Math.max(params.size ?? 500, 1), 500)
    const [rows, total, moodCounts] = await Promise.all([
      this.prisma.meme.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: size,
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      }),
      this.prisma.meme.count({ where }),
      // 情绪 chips 上的计数基于同一筛选条件（不含 mood 自身），避免前端再拉一遍
      this.prisma.meme.groupBy({ by: ['mood'], where: { ...where, mood: undefined }, _count: true }),
    ])

    return {
      data: rows.map((row) => this.toPublic(row)),
      meta: {
        total,
        moodCounts: Object.fromEntries(moodCounts.map((m) => [m.mood, m._count])),
      },
    }
  }

  /** 我的投喂：自己的全部状态（含 pending/rejected），按时间倒序 */
  async findMine(userId: string) {
    const rows = await this.prisma.meme.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    })
    // 直接返回数组（响应拦截器会包成 {code, message, data}），不要套 {data} 造成两层 data
    return rows.map((row) => this.toPublic(row))
  }

  async findById(id: string, viewerId?: string) {
    const row = await this.prisma.meme.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    })
    if (!row) throw new NotFoundException('表情包不存在')
    if (row.status !== 'approved' && row.userId !== viewerId) {
      throw new NotFoundException('表情包不存在')
    }
    return this.toPublic(row)
  }

  /**
   * 用户投喂：GIF/PNG/WebP ≤5MB，sharp 验真实格式（magic bytes，不信 Content-Type），
   * 边长 32~4096px，每日每用户 ≤20 张。入库默认 pending，等管理员审核后进鱼塘。
   */
  async upload(file: Express.Multer.File, userId: string, raw: { title: string; mood?: string; tags?: string; note?: string }) {
    if (!file) throw new BadRequestException('请选择要上传的表情包')

    const title = cleanText(raw.title, 50)
    if (!title) throw new BadRequestException('请填写表情包标题')

    const mood = raw.mood && isMemeMood(raw.mood) ? raw.mood : 'fish'
    const note = raw.note ? cleanText(raw.note, 200) : null
    const tags = (raw.tags ?? '')
      .split(/[,，]/)
      .map((t) => cleanText(t, 16).replace(/^#+/, ''))
      .filter(Boolean)
      .slice(0, 5)

    // 用 sharp metadata 验证真实文件类型（与 upload.service 同一招），不信任客户端 mimetype
    let metadata: sharp.Metadata
    try {
      metadata = await sharp(file.buffer, { limitInputPixels: 50_000_000, animated: true }).metadata()
    } catch {
      throw new BadRequestException('无法识别的图片格式')
    }
    const format = metadata.format ?? ''
    if (!EXT_BY_FORMAT[format]) {
      throw new BadRequestException('仅支持 GIF、PNG、WebP 格式')
    }
    const width = metadata.width ?? 0
    const height = (metadata.pageHeight ?? metadata.height) ?? 0
    if (width < MEME_MIN_EDGE || height < MEME_MIN_EDGE) {
      throw new BadRequestException(`图片太小了（最短边至少 ${MEME_MIN_EDGE}px）`)
    }
    if (width > MEME_MAX_EDGE || height > MEME_MAX_EDGE) {
      throw new BadRequestException(`图片太大了（最长边不超过 ${MEME_MAX_EDGE}px）`)
    }

    // 每日配额（防滥用）。只计 source=user 的投喂：合集归档（seed 批量导入）
    // 不该占用户的手工上传额度，否则导入当天本人就无法投喂。
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = await this.prisma.meme.count({
      where: { userId, source: 'user', createdAt: { gte: today } },
    })
    if (todayCount >= MEME_DAILY_LIMIT) {
      throw new BadRequestException(`今日投喂次数已达上限（${MEME_DAILY_LIMIT} 张）`)
    }

    // 上传 MinIO：原图直接存（表情包靠动画，不做重编码），对象名带随机串、内容永不覆盖
    const ext = EXT_BY_FORMAT[format]
    const name = `meme-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const putMeta: ObjectMeta = {
      'Content-Type': CONTENT_TYPE_BY_EXT[ext],
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    await this.minioService.putObject(name, file.buffer, putMeta)

    // code 用 up- 前缀 + 随机串，与合集的 gif-NNN 命名空间分开
    const code = `up-${Math.random().toString(36).slice(2, 10)}`
    const created = await this.prisma.meme.create({
      data: {
        code,
        title,
        note,
        mood,
        tags: tags.join(','),
        url: `${this.minioService.baseUrl}/${name}`,
        status: 'pending',
        source: 'user',
        userId,
      },
    })

    return { id: created.id, code: created.code, message: '投喂成功，等待管理员审核' }
  }

  /** 作者删除自己的表情包（撤回投喂）；已上架的删除后同步从鱼塘消失 */
  async remove(id: string, userId: string) {
    const meme = await this.prisma.meme.findUnique({ where: { id } })
    if (!meme) throw new NotFoundException('表情包不存在')
    if (meme.userId !== userId) throw new ForbiddenException('只能删除自己的投喂')

    await this.deleteById(id)
    return { id, deleted: true }
  }

  /**
   * 删库 + 删 MinIO 对象。合集条目（source=archive）指向客户端静态资源，
   * 不在 MinIO 里，跳过对象删除——静态文件由发布流程管理。
   */
  async deleteById(id: string) {
    const meme = await this.prisma.meme.findUnique({ where: { id } })
    if (!meme) throw new NotFoundException('表情包不存在')

    if (meme.source === 'user') {
      try {
        const filename = meme.url.split('/').pop()
        if (filename) await this.minioService.removeObject(filename)
      } catch {
        // MinIO 删除失败不阻塞数据库删除（与 deleteImage 同策略）
      }
    }
    await this.prisma.meme.delete({ where: { id } })
    return { id, deleted: true }
  }
}
