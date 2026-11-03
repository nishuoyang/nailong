import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { AvatarService } from './avatar.service'
import { UsersController } from './users.controller'

@Module({
  controllers: [UsersController],
  providers: [UsersService, AvatarService],
  exports: [UsersService],
})
export class UsersModule {}
