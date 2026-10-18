import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PaginationDto } from '../common/dto/pagination.dto'
import { FavoritesService } from './favorites.service'

@Controller()
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Post('images/:id/favorite')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async toggle(@Param('id') imageId: string, @CurrentUser() user: { id: string }) {
    return this.favoritesService.toggle(user.id, imageId)
  }

  @Get('users/me/favorites')
  async mine(@CurrentUser() user: { id: string }, @Query() query: PaginationDto) {
    return this.favoritesService.listMine(user.id, query.page, query.size)
  }
}
