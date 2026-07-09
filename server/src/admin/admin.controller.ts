import { Controller, Get, Patch, Delete, Post, Put, Param, Body, Query } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { AdminService } from './admin.service'

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

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
}
