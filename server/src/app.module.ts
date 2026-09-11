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

// 静态资源缓存策略（setHeaders 回调在 send 模块写入默认头之前触发，
// 且 send 仅在 Cache-Control 缺失时才写默认值，因此这里的设置会生效）
function setStaticCacheHeaders(res: any, filePath: string) {
  const normalized = filePath.replace(/\\/g, '/')

  // index.html 绝不长缓存：它引用的 assets 文件名带内容 hash，必须每次校验
  if (normalized.endsWith('/index.html')) {
    res.setHeader('Cache-Control', 'no-cache')
    return
  }

  // Vite 产物：/assets/xxx-<hash>.js|css，内容变则文件名变，可永久强缓存
  if (normalized.includes('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }

  // 其余静态资源（logo.png、story/*.jpg、favicon.svg 等）文件名不含 hash，
  // 给 1 天缓存：既省掉重复校验，又能在替换素材后于一天内生效
  res.setHeader('Cache-Control', 'public, max-age=86400')
}

// 客户端构建产物路径（仅在目录存在时启用静态文件服务）
// Docker 中默认 client/dist；本地开发从 server/ 目录运行时设置 CLIENT_DIST_PATH=../client/dist
const clientDistPath = resolve(process.env.CLIENT_DIST_PATH || 'client/dist')
const staticImports = existsSync(clientDistPath)
  ? [
      ServeStaticModule.forRoot({
        rootPath: clientDistPath,
        // 排除 API 和 MinIO 代理路由，避免与后端接口冲突
        // 注意：Express 4 内部使用 path-to-regexp@0.1.x，(.*) 编译成 (?:\.(.*)) 要求路径含点号，
        // 必须用 * 通配符才能匹配无扩展名的路由（/featured、/admin 等）
        exclude: ['/api/*', '/minio/*'],
        // SPA 回退：Vue Router history 模式下，非文件请求返回 index.html
        // renderPath 必须是字符串（内部 validatePath 调用 charAt）；用 * 而非 (.*)
        renderPath: '*',
        serveStaticOptions: {
          setHeaders: setStaticCacheHeaders,
          // 关闭目录重定向：dist 下存在 story/ 素材目录，而 /story 本身是 Vue 路由。
          // 默认 redirect:true 会让 /story 命中目录并 301 到 /story/，多一次往返。
          // 关掉后直接落到下面的 SPA 回退，一次 200 返回。
          redirect: false,
        },
      }),
    ]
  : []

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'nailong-jwt-secret-dev-only' }),
    // --- 限流 ---
    //
    // 【配额口径，重要】ThrottlerGuard 的 generateKey 把「控制器名 + 处理器名 + IP」拼进 key，
    // 所以配额是 **按单个接口、按 IP** 计数的，不是整个站点的总量。
    // 首页会并发调 4 个不同接口，各算各的，不会互相消耗配额。
    //
    // 从 100 提到 600 的原因：国内运营商普遍做 NAT，一个公网 IP 背后可能是几十个真实用户，
    // 「按 IP 计数」在共享出口下会叠加。按实名用户的行为（翻页 20-30 次/分钟）留 6 倍余量。
    // 真正需要收紧的是登录/注册，用 @Throttle 在 AuthController 上单独覆盖（见那边注释）。
    //
    // 注意两个坑：
    //  1. 必须用对象形式（{ throttlers: [...] }）而不是数组形式 ——
    //     guard 的 getErrorMessage 只在 options 不是数组时才读 errorMessage，
    //     用数组形式写 errorMessage 会被静默忽略，429 的 message 仍是
    //     英文的 "ThrottlerException: Too Many Requests"。
    //  2. 存储是内存实现（ThrottlerStorage 默认内存），配额按进程算。
    //     当前只有单副本部署，够用；将来横向扩容需要换 Redis 存储，
    //     否则实际额度会随副本数翻倍。
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 600 }],
      errorMessage: '请求过于频繁，请稍后再试',
    }),
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
