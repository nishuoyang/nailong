import { Controller, Get, Patch, Delete, Post, Put, Param, Body, Query, ServiceUnavailableException } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { AdminService } from './admin.service'
import { RedisService } from '../redis/redis.service'

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private redisService: RedisService,
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
    const [registration, loginRestricted] = await Promise.all([
      this.redisService.get('setting:registration'),
      this.redisService.get('setting:login_restricted'),
    ])
    return {
      registrationOpen: registration !== 'false',
      loginRestricted: loginRestricted === 'true',
    }
  }

  @Patch('settings')
  async updateSettings(@Body() body: { registrationOpen?: boolean; loginRestricted?: boolean }) {
    // 这两个开关目前只存在 Redis 里（不在数据库），写失败却返回成功会让管理员误以为已生效，
    // 而实际状态仍是「开放」——对「关闭注册」「仅管理员可登录」这种应急开关是危险的静默失败。
    // 因此这里检查写入结果，失败就明确报错。
    const writes: Array<Promise<boolean>> = []
    if (body.registrationOpen !== undefined) {
      writes.push(this.redisService.set('setting:registration', body.registrationOpen ? 'true' : 'false'))
    }
    if (body.loginRestricted !== undefined) {
      writes.push(this.redisService.set('setting:login_restricted', body.loginRestricted ? 'true' : 'false'))
    }

    const results = await Promise.all(writes)
    if (results.some((ok) => !ok)) {
      throw new ServiceUnavailableException('设置保存失败：缓存服务不可用，请稍后重试')
    }

    return await this.getSettings()
  }
}
