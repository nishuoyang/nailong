import { Global, Module } from '@nestjs/common'
import { SettingsService } from './settings.service'

/**
 * 站点开关（注册/登录限制）。
 *
 * 与 PrismaModule / RedisModule / MinioModule 一样标 @Global：它是横跨 auth 与 admin 的
 * 基础设施型服务，跟着本仓库既有约定走，避免以后新增调用方时忘加 imports。
 */
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
