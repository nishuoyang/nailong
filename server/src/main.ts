import 'reflect-metadata';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createServer } from 'http';
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

  // --- HTTPS 配置 ---
  const httpsEnabled =
    process.env.HTTPS_ENABLED === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED !== 'false');
  const httpsOptions = httpsEnabled ? loadHttpsOptions() : undefined;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });

  // 信任代理头（X-Forwarded-Proto 等）
  if (httpsEnabled) {
    app.set('trust proxy', 1);
  }

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
    if (httpsEnabled) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // --- MinIO 代理中间件（避免 HTTPS 页面加载 HTTP 图片导致 mixed content）---
  const minioService = app.get(MinioService);
  app.use('/minio', async (req: Request, res: Response) => {
    try {
      // 路径格式: /minio/{bucket}/{objectName}
      const path = decodeURIComponent(req.path.replace(/^\/minio\//, ''));
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
        // stat 失败时使用默认 content-type，仍尝试获取对象
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
  const protocol = httpsOptions ? 'https' : 'http';
  await app.listen(port);
  console.log(`奶龙 server running on ${protocol}://localhost:${port}`);

  // --- HTTP → HTTPS 重定向 ---
  const redirectPort = parseInt(process.env.REDIRECT_HTTP_PORT || '', 10);
  if (httpsEnabled && redirectPort) {
    createServer((req, res) => {
      const host = req.headers.host?.replace(/:\d+$/, '') || 'localhost';
      const httpsPort = port === 443 ? '' : `:${port}`;
      res.writeHead(301, { Location: `https://${host}${httpsPort}${req.url}` });
      res.end();
    }).listen(redirectPort);
    console.log(`HTTP→HTTPS redirect listening on port ${redirectPort}`);
  }
}

/**
 * 读取 SSL 证书文件，不存在时退出进程
 */
function loadHttpsOptions(): { key: Buffer; cert: Buffer } {
  const keyPath = resolve(process.env.SSL_KEY_PATH || 'static/nailonghub.top.key');
  const certPath = resolve(process.env.SSL_CERT_PATH || 'static/nailonghub.top.pem');

  if (!existsSync(keyPath)) {
    console.error(`FATAL: SSL key not found at ${keyPath}`);
    process.exit(1);
  }
  if (!existsSync(certPath)) {
    console.error(`FATAL: SSL cert not found at ${certPath}`);
    process.exit(1);
  }

  console.log(`SSL 证书已加载: ${certPath}`);
  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}

bootstrap();
