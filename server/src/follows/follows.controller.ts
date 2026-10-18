import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PaginationDto } from '../common/dto/pagination.dto'
import { FollowsService } from './follows.service'

@Controller()
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post('users/:id/follow')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async toggle(@Param('id') targetId: string, @CurrentUser() user: { id: string }) {
    return this.followsService.toggle(user.id, targetId)
  }

  @Public()
  @Get('users/:id/followers')
  async followers(
    @Param('id') userId: string,
    @Query() query: PaginationDto,
    @CurrentUser() viewer?: { id: string },
  ) {
    return this.followsService.listFollowers(userId, query.page, query.size, viewer?.id)
  }

  @Public()
  @Get('users/:id/following')
  async following(
    @Param('id') userId: string,
    @Query() query: PaginationDto,
    @CurrentUser() viewer?: { id: string },
  ) {
    return this.followsService.listFollowing(userId, query.page, query.size, viewer?.id)
  }

  @Get('feed')
  async feed(@CurrentUser() user: { id: string }, @Query() query: PaginationDto) {
    return this.followsService.feed(user.id, query.page, query.size)
  }
}
