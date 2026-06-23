import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
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
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
    @Body('title') title: string,
    @Body('description') description?: string,
    @Body('categoryIds') categoryIds?: string,
  ) {
    const ids = categoryIds ? JSON.parse(categoryIds) : undefined
    return this.uploadService.uploadImage(file, user.id, title, description, ids)
  }
}
