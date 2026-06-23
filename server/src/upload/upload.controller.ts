import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { UploadService } from './upload.service'

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: { id: string },
    @Body('title') title: string,
    @Body('description') description?: string,
    @Body('categoryIds') categoryIds?: string,
  ) {
    let ids: string[] | undefined
    if (categoryIds) {
      try {
        ids = JSON.parse(categoryIds)
        if (!Array.isArray(ids)) ids = undefined
      } catch {
        // categoryIds 格式无效，忽略
      }
    }
    return this.uploadService.uploadImage(file, user.id, title, description, ids)
  }
}
