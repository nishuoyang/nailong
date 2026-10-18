import { Controller, Get, Param, Query } from '@nestjs/common'
import { Public } from '../common/decorators/public.decorator'
import { TagsService } from './tags.service'

@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Public()
  @Get()
  async list(@Query('limit') limit?: string, @Query('q') q?: string) {
    return this.tagsService.list(limit ? Number(limit) : 40, q)
  }

  @Public()
  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    return this.tagsService.findBySlug(slug)
  }
}
