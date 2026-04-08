import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const uploadDir = configService.get<string>('UPLOAD_DIR', 'uploads');
  mkdirSync(join(process.cwd(), uploadDir), { recursive: true });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '');

  const configuredOrigins = configService
    .get<string>(
      'CORS_ORIGINS',
      [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://192.168.1.29:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://192.168.1.29:3000',
      ].join(','),
    )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const h5BaseUrl = configService.get<string>('H5_BASE_URL', '').trim();
  const allowedOrigins = new Set(
    [...configuredOrigins, h5BaseUrl]
      .filter(Boolean)
      .map((item) => normalizeOrigin(item)),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    credentials: true,
  });

  const host = configService.get<string>('HOST', '0.0.0.0');
  const port = Number(configService.get<string>('PORT', '3000'));
  await app.listen(port, host);

  console.log(`Backend started at ${await app.getUrl()}`);
}

bootstrap();
