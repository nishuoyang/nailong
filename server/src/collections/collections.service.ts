import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { cleanText } from '../common/utils/text'
import type { CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto'

const MAX_COLLECTIONS_PER_USER = 30
const MAX_ITEMS_PER_COLLECTION = 200

function parsePage(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}
function parseSize(value?: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 50) : 20
}

const previewInclude = {
  items: {
    take: 4,
    orderBy: { createdAt: 'desc' as const },
    include: {
      image: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          thumbnailSmUrl: true,
          width: true,
          height: true,
          dominantColor: true,
        },
      },
    },
  },
  _count: { select: { items: true } },
  user: { select: { id: true, username: true, avatarUrl: true } },
}

@Injectable()
export class CollectionsService {
  constructor(private prisma: PrismaService) {}

  private shape(collection: any) {
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      userId: collection.userId,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      user: collection.user,
      itemCount: collection._count?.items ?? collection.items?.length ?? 0,
      previews: (collection.items ?? []).map((item: any) => item.image),
    }
  }

  async listPublic(page?: number, size?: number) {
    const pageNum = parsePage(page)
    const sizeNum = parseSize(size)
    const where = { isPublic: true }
    const [rows, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: previewInclude,
      }),
      this.prisma.collection.count({ where }),
    ])
    return {
      data: rows.map((row) => this.shape(row)),
      meta: { page: pageNum, size: sizeNum, total, totalPages: Math.ceil(total / sizeNum) || 1 },
    }
  }

  async listMine(userId: string, imageId?: string) {
    const rows = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: previewInclude,
    })

    // Membership lookup is one query for the whole list rather than N detail reads.
    let contained = new Set<string>()
    if (imageId && rows.length > 0) {
      const items = await this.prisma.collectionItem.findMany({
        where: { imageId, collectionId: { in: rows.map((row) => row.id) } },
        select: { collectionId: true },
      })
      contained = new Set(items.map((item) => item.collectionId))
    }

    return rows.map((row) => ({
      ...this.shape(row),
      containsImage: imageId ? contained.has(row.id) : undefined,
    }))
  }

  async listByUser(userId: string, viewer?: { id: string; role: string }) {
    const isOwner = viewer?.id === userId
    const isAdmin = viewer?.role === 'admin'
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true },
    })
    if (!user) throw new NotFoundException('用户不存在')

    const rows = await this.prisma.collection.findMany({
      where: { userId, ...(isOwner || isAdmin ? {} : { isPublic: true }) },
      orderBy: { updatedAt: 'desc' },
      include: previewInclude,
    })

    return rows.map((row) => this.shape(row))
  }

  async findOne(id: string, viewer?: { id: string; role: string }) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { items: true } },
        items: {
          orderBy: { createdAt: 'desc' },
          include: {
            image: {
              include: {
                user: { select: { id: true, username: true, avatarUrl: true } },
                categories: { include: { category: true } },
                tags: { include: { tag: true } },
              },
            },
          },
        },
      },
    })
    if (!collection) throw new NotFoundException('收藏夹不存在')

    const isOwner = viewer?.id === collection.userId
    const isAdmin = viewer?.role === 'admin'
    if (!collection.isPublic && !isOwner && !isAdmin) {
      // 404 rather than 403: private collections should not reveal their existence.
      throw new NotFoundException('收藏夹不存在')
    }

    return {
      ...this.shape(collection),
      isOwner,
      items: collection.items.map((item) => ({
        ...item.image,
        categories: item.image.categories.map((c) => c.category),
        tags: item.image.tags.map((t) => t.tag),
        addedAt: item.createdAt,
      })),
    }
  }

  async create(userId: string, dto: CreateCollectionDto) {
    const count = await this.prisma.collection.count({ where: { userId } })
    if (count >= MAX_COLLECTIONS_PER_USER) {
      throw new BadRequestException(`最多创建 ${MAX_COLLECTIONS_PER_USER} 个收藏夹`)
    }
    const name = cleanText(dto.name, 40)
    if (!name) throw new BadRequestException('收藏夹名称不能为空')

    const collection = await this.prisma.collection.create({
      data: {
        userId,
        name,
        description: dto.description ? cleanText(dto.description, 200) : null,
        isPublic: dto.isPublic ?? true,
      },
      include: previewInclude,
    })
    return this.shape(collection)
  }

  private async ownedCollection(id: string, user: { id: string; role: string }) {
    const collection = await this.prisma.collection.findUnique({ where: { id } })
    if (!collection) throw new NotFoundException('收藏夹不存在')
    if (collection.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('只能编辑自己的收藏夹')
    }
    return collection
  }

  async update(id: string, user: { id: string; role: string }, dto: UpdateCollectionDto) {
    await this.ownedCollection(id, user)
    const data: any = {}
    if (dto.name !== undefined) {
      const name = cleanText(dto.name, 40)
      if (!name) throw new BadRequestException('收藏夹名称不能为空')
      data.name = name
    }
    if (dto.description !== undefined) data.description = cleanText(dto.description, 200) || null
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic

    const collection = await this.prisma.collection.update({
      where: { id },
      data,
      include: previewInclude,
    })
    return this.shape(collection)
  }

  async remove(id: string, user: { id: string; role: string }) {
    await this.ownedCollection(id, user)
    await this.prisma.collection.delete({ where: { id } })
    return { id, deleted: true }
  }

  async addImage(id: string, user: { id: string; role: string }, imageId: string) {
    const collection = await this.ownedCollection(id, user)
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true, status: true },
    })
    if (!image || image.status !== 'approved') throw new NotFoundException('图片不存在')

    const count = await this.prisma.collectionItem.count({ where: { collectionId: id } })
    if (count >= MAX_ITEMS_PER_COLLECTION) {
      throw new BadRequestException(`一个收藏夹最多 ${MAX_ITEMS_PER_COLLECTION} 张图片`)
    }

    try {
      await this.prisma.$transaction([
        this.prisma.collectionItem.create({ data: { collectionId: id, imageId } }),
        this.prisma.collection.update({ where: { id }, data: { updatedAt: new Date() } }),
      ])
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err
    }

    const total = await this.prisma.collectionItem.count({ where: { collectionId: id } })
    return { collectionId: id, imageId, added: true, itemCount: total, isPublic: collection.isPublic }
  }

  async removeImage(id: string, user: { id: string; role: string }, imageId: string) {
    await this.ownedCollection(id, user)
    const result = await this.prisma.collectionItem.deleteMany({
      where: { collectionId: id, imageId },
    })
    await this.prisma.collection.update({ where: { id }, data: { updatedAt: new Date() } })
    const total = await this.prisma.collectionItem.count({ where: { collectionId: id } })
    return { collectionId: id, imageId, removed: result.count > 0, itemCount: total }
  }
}