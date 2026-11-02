import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { MemesService } from './memes.service'

@Controller('memes')
export class MemesController {
  constructor(private memesService: MemesService) {}

  /** 公开鱼塘：只出已审核的，支持情绪筛选/搜索 */
  @Public()
  @Get()
  async findAll(
    @Query('mood') mood?: string,
    @Query('search') search?: string,
    @Query('size') size?: string,
  ) {
    return this.memesService.findAll({
      mood,
      search,
      size: size ? Number(size) : undefined,
    })
  }

  /** 我的投喂：含待审核/已拒绝，便于作者跟进状态 */
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async findMine(@CurrentUser() user: { id: string }) {
    return this.memesService.findMine(user.id)
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.memesService.findById(id, user?.id)
  }

  /**
   * 投喂一张表情包。限制：GIF/PNG/WebP、≤5MB、边长 32~4096px、每人每日 20 张；
   * 入库默认 pending，管理员审核通过后进公开鱼塘。
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^(image\/gif|image\/png|image\/webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: { id: string },
    @Body('title') title: string,
    @Body('mood') mood?: string,
    @Body('tags') tags?: string,
    @Body('note') note?: string,
  ) {
    return this.memesService.upload(file, user.id, { title, mood, tags, note })
  }

  /** 作者撤回自己的投喂 */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.memesService.remove(id, user.id)
  }
}
