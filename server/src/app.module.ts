import { Module } from '@nestjs/common'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ServeStaticModule } from '@nestjs/serve-static'
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { RedisModule } from './redis/redis.module'
import { MinioModule } from './minio/minio.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ImagesModule } from './images/images.module'
import { UploadModule } from './upload/upload.module'
import { LikesModule } from './likes/likes.module'
import { AdminModule } from './admin/admin.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { AppController } from './app.controller'

// 客户端构建产物路径（仅在目录存在时启用静态文件服务）
// Docker 中默认 client/dist；本地开发从 server/ 目录运行时设置 CLIENT_DIST_PATH=../client/dist
const clientDistPath = resolve(process.env.CLIENT_DIST_PATH || 'client/dist')
const staticImports = existsSync(clientDistPath)
  ? [
      ServeStaticModule.forRoot({
        rootPath: clientDistPath,
        // 排除 API 和 MinIO 代理路由，避免与后端接口冲突
        exclude: ['/api/(.*)', '/minio/(.*)'],
        // SPA 回退：Vue Router history 模式下，非文件请求返回 index.html
        serveRoot: '/',
        renderPath: '*',
      }),
    ]
  : []

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'nailong-jwt-secret-dev-only' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    MinioModule,
    AuthModule,
    UsersModule,
    ImagesModule,
    UploadModule,
    LikesModule,
    AdminModule,
    ...staticImports,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
