import 'reflect-metadata';
import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { MinioService } from './minio/minio.service';
import { streamObjectFromMinio } from './common/http/stream-object';
import { AppFileLogger } from './common/logging/app-file-logger';

/**
 * 优雅关闭的硬上限。
 *
 * 必须**明显小于** docker 的停止宽限期（生产 compose 没设 stop_grace_period，
 * 即 Docker 默认 10 秒），否则这个「强制退出」永远轮不到执行，等于没写。
 */
const SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * 优雅关闭（2026-09-11）。
 *
 * 为什么必须有这段 —— 两条都是实测出来的，不是「最佳实践」式的装饰：
 *
 * 1. **在此之前，这个应用从未优雅关闭过。**
 *    实测：`docker kill -s TERM` 之后 3 秒，容器状态仍然是 running —— SIGTERM 被完全忽略，
 *    只能等 docker 的宽限期走完再 SIGKILL。
 *    原因是应用就是容器的 PID 1（`entrypoint.sh` 里的 `exec node` 正是为了让
 *    `docker stop` 的信号直达 node），而**内核对 PID 1 不施加信号的默认动作**：
 *    disposition 为 SIG_DFL 时，SIGTERM 在 PID 1 上等同于被忽略。
 *    **装上 handler 之后信号才会被投递** —— 这才是必须在这里注册 handler 的根本原因，
 *    而不是「为了体面」。
 *
 * 2. 它造成的代价有两块，都不是理论问题：
 *    - 每次发布/回滚都要白等 10 秒：旧容器早已收到停止请求却还在服务，而新容器必须
 *      等旧容器退出之后才开始创建（生产实测：`docker compose up -d` 到新容器打出第一行
 *      日志之间有 11.1 秒）。
 *    - 正在传输的响应会被 SIGKILL 拦腰截断：图片下载/上传走到一半被切断，
 *      浏览器拿到的是残缺文件（而不是一个明确的失败）。
 *
 * 3. 为什么**不用** Nest 的 `enableShutdownHooks()`：
 *    它注册的 handler 只调用 `app.close()`，**不退出进程**。本项目还有 ioredis、
 *    Prisma 引擎、MinIO 连接等句柄，只要有一个没随 app.close() 释放，进程就会一直
 *    挂在事件循环上 —— 结果又回到「等满宽限期被 SIGKILL」，优雅关闭白做。
 *    所以这里自己拿控制权：关闭完成后明确 exit(0)。
 *
 * 4. 硬上限的作用：若某个连接把 `app.close()` 卡住（例如一个还没传完的大文件），
 *    到点强制退出，避免又退化成 SIGKILL。这也是上面 SHUTDOWN_TIMEOUT_MS 必须
 *    远小于宽限期的原因。
 */
function installGracefulShutdown(app: INestApplication): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return; // 连按 Ctrl-C 不应触发第二次关闭流程
    shuttingDown = true;
    console.log(`收到 ${signal}：停止接收新连接，等待进行中的请求完成…`);

    const forced = setTimeout(() => {
      console.error(`优雅关闭超过 ${SHUTDOWN_TIMEOUT_MS}ms 仍未结束，强制退出`);
      process.exit(0);
    }, SHUTDOWN_TIMEOUT_MS);
    forced.unref();

    try {
      // app.close() 会依次调用各模块的 onModuleDestroy（Prisma $disconnect、Redis quit），
      // 并关闭 HTTP server：不再接受新连接，Node 20 起也会主动关闭空闲的 keep-alive 连接，
      // 只等待真正还在传输的请求。
      await app.close();
      console.log('HTTP 服务与数据库/Redis 连接已关闭，正常退出');
    } catch (err) {
      console.error('关闭过程中出错（仍然退出）:', err instanceof Error ? err.message : err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

async function bootstrap() {
  // --- 应用日志落盘 ---
  // 必须在**任何其它动作之前**装好：下面的生产环境校验失败会直接 process.exit(1)，
  // 而那正是最需要留下证据的一刻。而 `docker logs` 只读当前容器 —— 每次发布
  // （docker compose up -d）都换新容器，旧日志随之消失，事后无法取证。
  // 详见 common/logging/app-file-logger.ts 顶部说明。
  const fileLogger = new AppFileLogger();
  fileLogger.installConsoleTee();
  fileLogger.log(`应用日志文件：${fileLogger.describe()}`, 'AppLog');

  // --- 生产环境校验 ---
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtSecret || jwtSecret === 'nailong-jwt-secret-dev-only') {
      console.error('FATAL: JWT_SECRET must be set in production');
      process.exit(1);
    }
    if (!jwtRefreshSecret || jwtRefreshSecret === 'nailong-refresh-secret-dev-only') {
      console.error('FATAL: JWT_REFRESH_SECRET must be set in production');
      process.exit(1);
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: fileLogger });

  // --- 信任反向代理 ---
  // 生产环境前面是 Caddy（终止 TLS 并反代）。若不声明信任代理，req.ip 会是 Caddy 的容器 IP，
  // 而 ThrottlerGuard 正是用 req.ip 做 tracker（@nestjs/throttler 的 getTracker 直接 return req.ip），
  // 结果就成了全站所有用户共用一个配额：100 次/分钟会退化成整个站点的总量上限。
  // 设为 1 表示只信任最近一跳代理（Caddy 会自动写入 X-Forwarded-For）。
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');

  // --- 响应压缩（gzip）---
  // 必须是第一个中间件：ServeStaticModule 是在 onModuleInit（即 app.listen() 时）
  // 才注册 express.static 的，此处注册的压缩中间件会排在它前面，
  // 否则 index.html / assets/*.js / assets/*.css 不会被压缩。
  // 注意：Content-Encoding 只作用于文本资源；image/* 属于不可压缩类型，
  // compression 会按 Content-Type 自动跳过（图片不会重复压缩）。
  app.use(
    compression({
      // 小于 1KB 的响应不压缩，压缩头本身的开销不划算
      threshold: 1024,
      // zlib level 6 是吞吐与压缩率的最佳平衡点，调到 9 收益极小但 CPU 明显上升
      level: 6,
    }),
  );

  // CORS origin 从环境变量读取，逗号分隔
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? ['http://localhost:5173'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- 安全响应头 ---
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-src https://player.bilibili.com; frame-ancestors 'none';",
    );
    next();
  });

  // --- MinIO 代理中间件（统一图片域名，支持后续 HTTPS 升级）---
  //
  // 为什么不改成「预签名 URL + 302 直连 MinIO」：
  //   1. 服务端 CSP 限定 img-src 'self'，直连需要额外放宽 CSP；
  //   2. 生产环境 MinIO 只在 Docker 内网可达（MINIO_ENDPOINT=minio），浏览器解析不了该主机名，
  //      要直连就得把 9000 端口暴露到公网并额外处理 HTTPS 混合内容；
  //   3. 本代理的存在意义正是「统一图片域名」，绕开它就等于放弃这个设计。
  // 因此保留代理，改为消掉它自身的开销（见下面的 Content-Type 推断与 Range 处理）。
  const minioService = app.get(MinioService);

  app.use('/minio', async (req: Request, res: Response) => {
    try {
      // app.use('/minio') 挂载后 req.path 已剥离前缀（只剩 /{bucket}/{object}），
      // 直接用 req.path 解析，不要再 replace /^\/minio\//
      const path = decodeURIComponent(req.path.slice(1)); // 去掉开头的 /
      const slashIdx = path.indexOf('/');
      if (slashIdx < 0) {
        res.status(400).json({ message: 'Invalid path' });
        return;
      }
      const bucket = path.slice(0, slashIdx);
      const objectName = path.slice(slashIdx + 1);

      // Content-Type 推断与 Range 处理都在共享实现里（与 /api/images/:id/file 下载接口共用同一份）
      await streamObjectFromMinio(req, res, minioService, { bucket, objectName });
    } catch (err: any) {
      if (err?.code === 'NoSuchKey' || err?.statusCode === 404) {
        res.status(404).end();
      } else {
        console.error('MinIO proxy error:', err?.message ?? err);
        res.status(500).end();
      }
    }
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`奶龙 server running on http://0.0.0.0:${port}`);

  // 监听 SIGTERM/SIGINT（`docker stop` / `docker compose up -d` 发出的就是 SIGTERM）。
  // 必须在 app 起来之后注册：关闭流程要用到 app.close()。
  installGracefulShutdown(app);
}

bootstrap();
