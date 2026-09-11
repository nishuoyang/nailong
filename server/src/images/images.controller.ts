import { Controller, Get, Param, Query, Req, Res, NotFoundException } from '@nestjs/common'
import { Request, Response } from 'express'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { MIME_BY_EXT, parseObjectRef, streamObjectFromMinio } from '../common/http/stream-object'
import { ImagesService } from './images.service'
import { MinioService } from '../minio/minio.service'

/**
 * 构造 RFC 6266 / RFC 5987 规范的 `Content-Disposition`。
 *
 * ⚠️ 不能只写 `attachment; filename="标题.jpg"`：
 * Node 会对响应头做 latin1 校验，而本站图片标题基本都是中文 ——
 * 直接 `setHeader` 会抛 `ERR_INVALID_CHAR: Invalid character in header content`，
 * 下载接口于是整个走异常分支退化成 302（旧实现正是如此，浏览器表现为
 * 「打开图片」而不是「下载」，且拿不到自定义文件名）。
 *
 * 正确做法是两份都给：ASCII 回退名给老客户端，`filename*` 用 UTF-8 百分号编码，
 * 现代浏览器优先采用后者，因此用户拿到的仍是中文文件名。
 */
function attachmentHeader(filename: string): string {
  const asciiFallback = filename
    // 非 ASCII（中文等）与 DEL 一律替换，控制字符顺带被清掉，避免响应头注入
    .replace(/[^\x20-\x7E]/g, '_')
    // 双引号与反斜杠会破坏 filename="..." 的引号语法
    .replace(/["\\]/g, '_')

  // encodeURIComponent 不转义 !'()*，而这四个字符不是 RFC 5987 的 attr-char，需要补转
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}

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
  //
  // 与 /minio 代理共用 streamObjectFromMinio()，因此同样支持 Range（断点续传 / 下载器多线程）。
  // 之前这里是「直接 getObject 后 pipe」：既没有 Accept-Ranges 也没有 206 处理，
  // 大图下载中断只能从头再来。
  @Public()
  @Get('images/:id/file')
  async getFile(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const image = await this.imagesService.findByIdRaw(id)
    if (!image || image.status !== 'approved') throw new NotFoundException('图片不存在')

    const url = image.url
    const { bucket, objectName } = parseObjectRef(url, this.minioService.bucket)
    const ext = objectName.split('.').pop()?.toLowerCase() || 'jpg'

    try {
      await streamObjectFromMinio(req, res, this.minioService, {
        bucket,
        objectName,
        contentType: MIME_BY_EXT[ext] || 'image/jpeg',
        // 下载接口不套 immutable：Content-Disposition 用的是图片标题，
        // 标题被管理员改动后文件名应当随之变化，所以给 1 天而不是一年
        cacheControl: 'public, max-age=86400',
        contentDisposition: attachmentHeader(`${image.title || 'image'}.${ext}`),
      })
    } catch {
      // MinIO 取文件失败，重定向到原始 URL
      res.redirect(url)
    }
  }

  @Public()
  @Get('other')
  async getOther(
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.imagesService.getOther({ page, size })
  }

  @Public()
  @Get('featured')
  async getFeatured(
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.imagesService.getFeatured({ page, size })
  }

  @Public()
  @Get('daily')
  async getDailyRecommendation() {
    return this.imagesService.getDailyRecommendation()
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
