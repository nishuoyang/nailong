import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // 生产环境校验：JWT 密钥不能使用默认值
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET
    if (!jwtSecret || jwtSecret === 'nailong-jwt-secret-dev-only') {
      console.error('FATAL: JWT_SECRET must be set in production')
      process.exit(1)
    }
    if (!jwtRefreshSecret || jwtRefreshSecret === 'nailong-refresh-secret-dev-only') {
      console.error('FATAL: JWT_REFRESH_SECRET must be set in production')
      process.exit(1)
    }
  }

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(3000);
  console.log('奶龙 server running on http://localhost:3000');
}
bootstrap();
