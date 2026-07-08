import { Controller, Get, Param, Query, Res, NotFoundException } from '@nestjs/common'
import { Response } from 'express'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { ImagesService } from './images.service'
import { MinioService } from '../minio/minio.service'

@Controller()
export class ImagesController {
  constructor(
    private imagesService: ImagesService,
    private minioService: MinioService,
  ) {}

  @Public()
  @Get('images')
  async findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: 'latest' | 'popular' | 'downloads',
  ) {
    return this.imagesService.findAll({ page, size, category, search, sort })
  }

  @Public()
  @Get('images/:id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.imagesService.findById(id, user?.id)
  }

  // 文件代理：通过服务端流式传输 MinIO 文件，解决跨域下载问题
  @Public()
  @Get('images/:id/file')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const image = await this.imagesService.findByIdRaw(id)
    if (!image) throw new NotFoundException('图片不存在')

    const url = image.url
    const filename = url.split('/').pop() || 'image'
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'

    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }

    try {
      const stream = await this.minioService.getObject(filename)
      res.set({
        'Content-Type': contentTypeMap[ext] || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${image.title || 'image'}.${ext}"`,
        'Cache-Control': 'public, max-age=86400',
      })
      stream.pipe(res)
    } catch {
      // MinIO 取文件失败，重定向到原始 URL
      res.redirect(url)
    }
  }

  @Public()
  @Get('leaderboard')
  async getLeaderboard() {
    return this.imagesService.getLeaderboard()
  }

  @Public()
  @Get('categories')
  async getCategories() {
    return this.imagesService.getCategories()
  }
}
