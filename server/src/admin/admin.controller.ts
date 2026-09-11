import { Controller, Get, Patch, Delete, Post, Put, Param, Body, Query, Req } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { AdminService } from './admin.service'
import { SettingsService } from '../settings/settings.service'

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private settingsService: SettingsService,
  ) {}

  @Get('images')
  async getImages(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.findAllImages({ page, size, status })
  }

  @Patch('images/:id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminService.updateImageStatus(id, status)
  }

  @Patch('images/:id/featured')
  async toggleFeatured(@Param('id') id: string) {
    return this.adminService.toggleFeatured(id)
  }

  @Patch('images/:id')
  async updateImage(
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string; categoryIds?: string[] },
  ) {
    return this.adminService.updateImage(id, body)
  }

  @Delete('images/:id')
  async deleteImage(@Param('id') id: string) {
    return this.adminService.deleteImage(id)
  }

  @Post('categories')
  async createCategory(@Body() body: { name: string; slug: string; description?: string }) {
    return this.adminService.createCategory(body)
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string; description?: string },
  ) {
    return this.adminService.updateCategory(id, body)
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id)
  }

  @Get('settings')
  async getSettings() {
    return this.settingsService.getAll()
  }

  @Patch('settings')
  async updateSettings(
    @Body() body: { registrationOpen?: boolean; loginRestricted?: boolean },
    @Req() req: { user?: { id?: string } },
  ) {
    // 开关存在数据库里（Setting 表），不再只存 Redis。
    // 旧实现因为 Redis 是唯一存储，必须检查写入结果并在失败时返回 503，
    // 否则会出现「提示已保存、实际没保存」；现在写库成功即真的持久化，
    // 写失败会由 Prisma 抛错并被全局异常过滤器转成 500。
    return this.settingsService.update(body, req.user?.id ?? null)
  }
}
