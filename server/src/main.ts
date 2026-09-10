import 'reflect-metadata';
import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { MinioService } from './minio/minio.service';

async function bootstrap() {
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  const MIME_BY_EXT: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    bmp: 'image/bmp',
  };

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

      // Content-Type 直接由扩展名推断：上传产物命名是受控的
      // （{base}_thumb_sm.webp / {base}_thumb_md.webp / {base}.{jpg|png|webp}），
      // 因此绝大多数请求不再需要为拿一个 Content-Type 而先向 MinIO 发 HEAD。
      // 图片请求的 MinIO 往返由 2 次（HEAD + GET）降为 1 次（GET）。
      const ext = objectName.split('.').pop()?.toLowerCase() ?? '';
      let contentType: string | undefined = MIME_BY_EXT[ext];

      const rangeHeader = req.headers.range as string | undefined;
      let offset: number | undefined;
      let length: number | undefined;
      let totalSize: number | undefined;

      // 只有两种情况仍需 HEAD：扩展名不认识（拿真实 Content-Type）或带 Range（要总长度算 Content-Range）。
      // 普通 <img> 不会带 Range，所以常规图片请求不付这个成本。
      if (!contentType || rangeHeader) {
        try {
          const stat = await minioService.statObject(bucket, objectName);
          contentType ??= (stat.metaData?.['content-type'] as string) || undefined;
          totalSize = stat.size;
        } catch {
          // 忽略：Content-Type 走兜底，Range 视为不生效（下面按整体返回 200）
        }
      }
      contentType ??= 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Accept-Ranges', 'bytes');

      if (rangeHeader && totalSize !== undefined) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
        if (m && (m[1] !== '' || m[2] !== '')) {
          let start: number;
          let end: number;
          if (m[1] === '') {
            // bytes=-N：最后 N 字节
            const suffix = parseInt(m[2], 10);
            start = Math.max(0, totalSize - suffix);
            end = totalSize - 1;
          } else {
            start = parseInt(m[1], 10);
            end = m[2] === '' ? totalSize - 1 : Math.min(parseInt(m[2], 10), totalSize - 1);
          }

          if (start > end || start >= totalSize) {
            res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
            res.end();
            return;
          }

          offset = start;
          length = end - start + 1;
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          res.setHeader('Content-Length', String(length));
        }
      }

      const stream = await minioService.getObjectFromBucket(bucket, objectName, offset, length);
      stream.pipe(res);
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
}

bootstrap();
