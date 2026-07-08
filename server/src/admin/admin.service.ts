import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService } from '../minio/minio.service'

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
  ) {}

  async findAllImages(params: { page?: number; size?: number; status?: string }) {
    const page = Number(params.page) || 1
    const size = Math.min(Number(params.size) || 20, 100)
    const { status } = params

    const where: any = {}
    if (status) where.status = status

    const [data, total] = await Promise.all([
      this.prisma.image.findMany({
        where,
        include: {
          user: { select: { id: true, username: true } },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.image.count({ where }),
    ])

    return { data, meta: { page, size, total, totalPages: Math.ceil(total / size) } }
  }

  async updateImageStatus(id: string, status: string) {
    const validStatuses = ['pending', 'approved', 'rejected', 'offline']
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('无效的状态值')
    }

    const image = await this.prisma.image.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('图片不存在')

    // 强制状态机转换规则
    const allowedTransitions: Record<string, string[]> = {
      pending: ['approved', 'rejected'],
      approved: ['offline'],
      rejected: [],
      offline: ['approved'], // 下架后可重新上架
    }

    const allowed = allowedTransitions[image.status]
    if (!allowed || !allowed.includes(status)) {
      throw new BadRequestException(
        `不允许从 "${image.status}" 转换为 "${status}"`,
      )
    }

    return this.prisma.image.update({
      where: { id },
      data: { status: status as any },
    })
  }

  async deleteImage(id: string) {
    const image = await this.prisma.image.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('图片不存在')

    // 从 MinIO 删除所有关联文件
    const urls = [image.url, image.thumbnailUrl, image.thumbnailSmUrl]
    for (const url of urls) {
      if (!url) continue
      try {
        const parts = url.split('/')
        const filename = parts[parts.length - 1]
        if (filename) {
          await this.minioService.removeObject(filename)
        }
      } catch {
        // MinIO 删除失败不阻塞数据库删除
      }
    }

    await this.prisma.image.delete({ where: { id } })
    return { message: '删除成功' }
  }

  async createCategory(data: { name: string; slug: string; description?: string }) {
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    })
    if (existing) {
      throw new BadRequestException('分类名称或 slug 已存在')
    }
    return this.prisma.category.create({ data })
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
    const category = await this.prisma.category.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('分类不存在')
    return this.prisma.category.update({ where: { id }, data })
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('分类不存在')

    const count = await this.prisma.imagesOnCategories.count({
      where: { categoryId: id },
    })
    if (count > 0) {
      throw new BadRequestException(`该分类下有 ${count} 张图片，请先移除关联`)
    }

    await this.prisma.category.delete({ where: { id } })
    return { message: '删除成功' }
  }
}
