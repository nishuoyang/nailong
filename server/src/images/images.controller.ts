import { Controller, Get, Param, Query } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { ImagesService } from './images.service'

@Controller()
export class ImagesController {
  constructor(private imagesService: ImagesService) {}

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

  @Public()
  @Get('categories')
  async getCategories() {
    return this.imagesService.getCategories()
  }
}
