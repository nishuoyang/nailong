import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
} from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { MAX_BATCH_IMAGES, UploadService } from './upload.service'

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  /**
   * 一次投稿可带多张图（同一批次）。
   *
   * 字段兼容两种写法：
   *  - `files`（多张，前端当前用法）；
   *  - `file`（单张，旧页面缓存里的老客户端仍在用，避免上线瞬间报 400）。
   *
   * 文件类型/大小/数量在 service 里统一校验：`ParseFilePipe` 只能对单个文件生效，
   * 用在这里会把多文件请求挡在门外。
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'files', maxCount: MAX_BATCH_IMAGES },
        { name: 'file', maxCount: 1 },
      ],
      // 略高于业务上限（10MB），让 service 里的中文提示先于 Multer 的英文报错生效
      { limits: { fileSize: 12 * 1024 * 1024, files: MAX_BATCH_IMAGES } },
    ),
  )
  async upload(
    @UploadedFiles()
    uploaded: { files?: Express.Multer.File[]; file?: Express.Multer.File[] },
    @CurrentUser() user: { id: string },
    @Body('title') title: string,
    @Body('description') description?: string,
    @Body('categoryIds') categoryIds?: string,
    @Body('section') section?: string,
    @Body('tags') tags?: string,
  ) {
    const files = [...(uploaded?.files ?? []), ...(uploaded?.file ?? [])]

    let ids: string[] | undefined
    if (categoryIds) {
      try {
        ids = JSON.parse(categoryIds)
        if (!Array.isArray(ids)) ids = undefined
      } catch {
        // categoryIds 格式无效，忽略
      }
    }
    return this.uploadService.uploadImages(files, user.id, title, description, ids, section, tags)
  }
}
