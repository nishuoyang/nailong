import { Controller, Get, Patch, Param, Body, UseGuards, Query } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'
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
  @Patch('me/bio')
  async updateBio(
    @CurrentUser() user: { id: string },
    @Body('bio') bio: string,
  ) {
    return this.usersService.updateBio(user.id, bio)
  }

  @Public()
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id)
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

  // 管理员审核 bio
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/approve-bio')
  async approveBio(@Param('id') id: string) {
    return this.usersService.approveBio(id)
  }

  // 管理员用户列表
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('bioStatus') bioStatus?: string,
  ) {
    return this.usersService.findAll(page, size, bioStatus)
  }

  // 管理员编辑用户
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { username?: string; email?: string; role?: string; bioStatus?: string; bio?: string },
  ) {
    return this.usersService.updateUser(id, body)
  }

  @Public()
  @Get(':id/images')
  async getUserImages(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.usersService.getUserImages(id, page, size)
  }
}
