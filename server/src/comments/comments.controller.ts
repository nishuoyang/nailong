import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PaginationDto } from '../common/dto/pagination.dto'
import { CommentsService } from './comments.service'
import { CreateCommentDto } from './dto/create-comment.dto'

@Controller()
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Public()
  @Get('images/:id/comments')
  async list(
    @Param('id') imageId: string,
    @Query() query: PaginationDto,
    @CurrentUser() user?: { id: string; role: string },
  ) {
    return this.commentsService.list(imageId, query.page, query.size, user)
  }

  @Post('images/:id/comments')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async create(
    @Param('id') imageId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.commentsService.create(imageId, user.id, dto.content)
  }

  @Delete('comments/:id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.commentsService.remove(id, user)
  }
}
