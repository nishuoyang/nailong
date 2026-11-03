import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PUBLIC_IMAGE_PIVOT_WHERE } from '../common/constants/image-visibility'

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tag list is intentionally small (a gallery vocabulary, not a social hashtag
   * firehose), so sorting by usage happens in memory and stays portable across
   * SQLite's limited aggregate ordering.
   *
   * 计数口径必须与发现页列表一致：只算 `approved + general`。
   * 否则标签会显示「3 张」，点进 #标签 页却是空的 —— 待审核、
   * 已下架、以及其他推荐（section='other'）的图片都不该出现在这里。
   * 同时用 `images: { some: ... }` 过滤掉公开作品为 0 的标签：
   * 上传时会先建标签、图片却还在待审核，这类标签对访客没有意义。
   */
  async list(limit = 40, q?: string) {
    const take = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 40
    const rows = await this.prisma.tag.findMany({
      where: {
        ...(q ? { name: { contains: q.trim() } } : {}),
        images: { some: PUBLIC_IMAGE_PIVOT_WHERE },
      },
      include: {
        _count: {
          select: { images: { where: PUBLIC_IMAGE_PIVOT_WHERE } },
        },
      },
    })
    return rows
      .map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug, count: tag._count.images }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, take)
  }

  /**
   * 标签存在但暂时没有公开作品时仍然返回（count=0），让标签页能显示
   * 「这个标签还是空的」而不是 404 —— 标签本身是有效词条。
   */
  async findBySlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { images: { where: PUBLIC_IMAGE_PIVOT_WHERE } },
        },
      },
    })
    if (!tag) throw new NotFoundException('标签不存在')
    return { id: tag.id, name: tag.name, slug: tag.slug, count: tag._count.images }
  }
}
