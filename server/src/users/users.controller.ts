import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PaginationDto } from '../common/dto/pagination.dto'
import { UsersService } from './users.service'
import { AvatarService, AVATAR_MAX_SIZE } from './avatar.service'
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private avatarService: AvatarService,
  ) {}

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

  /**
   * 上传头像（multipart/form-data，字段名 file）。
   *
   * 限制：JPEG/PNG/WebP、≤2MB、短边 ≥128px、边长 ≤4096px；
   * 服务端统一裁成 512×512 WebP 存 MinIO，并把 URL 写进 User.avatarUrl。
   *
   * 可选的取景框（cropX/cropY/cropSize，原图坐标）：
   * 前端画布让用户拖动缩放决定截哪一块，带上来后服务端按这块精确裁剪。
   * 不传则退回服务端的自动裁剪（老客户端兼容）。
   *
   * 只改自己的头像：userId 取自 JWT，不接受请求体传入。
   */
  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: AVATAR_MAX_SIZE }),
          new FileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: { id: string },
    @Body('cropX') cropX?: string,
    @Body('cropY') cropY?: string,
    @Body('cropSize') cropSize?: string,
  ) {
    // 取景框的校验需要原图尺寸与 EXIF 方向，那些只有 sharp 读得出，
    // 所以解析放在 service 里做（controller 只负责把字段原样带过去）。
    return this.avatarService.upload(file, user.id, { cropX, cropY, cropSize })
  }

  /** 恢复默认头像：清空 avatarUrl 并删掉旧文件 */
  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  async removeAvatar(@CurrentUser() user: { id: string }) {
    return this.avatarService.remove(user.id)
  }

  @Public()
  @Get(':id')
  async getPublicProfile(
    @Param('id') id: string,
    @CurrentUser() viewer?: { id: string },
  ) {
    return this.usersService.getPublicProfile(id, viewer?.id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/images')
  async getMyImages(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationDto,
  ) {
    return this.usersService.getMyImages(user.id, query.page, query.size)
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
    @Query() query: PaginationDto,
    @Query('bioStatus') bioStatus?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(query.page, query.size, bioStatus, search)
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
    @Query() query: PaginationDto,
  ) {
    return this.usersService.getUserImages(id, query.page, query.size)
  }
}