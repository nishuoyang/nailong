import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PaginationDto } from '../common/dto/pagination.dto'
import { CollectionsService } from './collections.service'
import { AddCollectionImageDto, CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto'

@Controller()
export class CollectionsController {
  constructor(private collectionsService: CollectionsService) {}

  @Public()
  @Get('collections')
  async list(@Query() query: PaginationDto) {
    return this.collectionsService.listPublic(query.page, query.size)
  }

  @Get('users/me/collections')
  async mine(@CurrentUser() user: { id: string }, @Query('imageId') imageId?: string) {
    return this.collectionsService.listMine(user.id, imageId)
  }

  @Public()
  @Get('users/:id/collections')
  async byUser(
    @Param('id') userId: string,
    @CurrentUser() viewer?: { id: string; role: string },
  ) {
    return this.collectionsService.listByUser(userId, viewer)
  }

  @Public()
  @Get('collections/:id')
  async detail(
    @Param('id') id: string,
    @CurrentUser() viewer?: { id: string; role: string },
  ) {
    return this.collectionsService.findOne(id, viewer)
  }

  @Post('collections')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(@Body() dto: CreateCollectionDto, @CurrentUser() user: { id: string }) {
    return this.collectionsService.create(user.id, dto)
  }

  @Patch('collections/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.collectionsService.update(id, user, dto)
  }

  @Delete('collections/:id')
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string; role: string }) {
    return this.collectionsService.remove(id, user)
  }

  @Post('collections/:id/images')
  async addImage(
    @Param('id') id: string,
    @Body() dto: AddCollectionImageDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.collectionsService.addImage(id, user, dto.imageId)
  }

  @Delete('collections/:id/images/:imageId')
  async removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.collectionsService.removeImage(id, user, imageId)
  }
}