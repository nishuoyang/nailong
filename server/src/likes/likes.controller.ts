import { Controller, Post, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { LikesService } from './likes.service'

@Controller()
export class LikesController {
  constructor(private likesService: LikesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('images/:id/like')
  async toggleLike(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.likesService.toggleLike(user.id, id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('images/:id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.likesService.handleDownload(user.id, id)
  }
}
