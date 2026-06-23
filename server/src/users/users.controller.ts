import { Controller, Get, UseGuards, Query } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.findById(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/images')
  async getMyImages(
    @CurrentUser() user: { id: string },
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.usersService.getMyImages(user.id, page, size)
  }
}
