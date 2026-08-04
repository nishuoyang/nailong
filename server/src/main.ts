import 'reflect-metadata';
import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
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
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none';",
    );
    next();
  });

  // --- MinIO 代理中间件（统一图片域名，支持后续 HTTPS 升级）---
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

      // 获取元数据以设置正确的 Content-Type
      let contentType = 'application/octet-stream';
      try {
        const stat = await minioService.statObject(bucket, objectName);
        contentType = stat.metaData?.['content-type'] || contentType;
      } catch {
        // stat 失败时根据扩展名推断
        const ext = objectName.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
        };
        contentType = mimeMap[ext || ''] || contentType;
      }

      const stream = await minioService.getObjectFromBucket(bucket, objectName);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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
