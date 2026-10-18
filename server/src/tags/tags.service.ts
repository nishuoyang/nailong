import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tag list is intentionally small (a gallery vocabulary, not a social hashtag
   * firehose), so sorting by usage happens in memory and stays portable across
   * SQLite's limited aggregate ordering.
   */
  async list(limit = 40, q?: string) {
    const take = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 40
    const rows = await this.prisma.tag.findMany({
      where: q ? { name: { contains: q.trim() } } : undefined,
      include: { _count: { select: { images: true } } },
    })
    return rows
      .map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug, count: tag._count.images }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, take)
  }

  async findBySlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: { _count: { select: { images: true } } },
    })
    if (!tag) throw new NotFoundException('标签不存在')
    return { id: tag.id, name: tag.name, slug: tag.slug, count: tag._count.images }
  }
}
