import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { UPLOADS_PREFIX, uploadsDir } from './storage/storage.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Archivos subidos (imágenes de preguntas). Lectura pública: son contenido de
  // la evaluación, y la app del alumno los pide sin token.
  app.useStaticAssets(uploadsDir(config), { prefix: UPLOADS_PREFIX });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') ??
    'http://localhost:5173,http://localhost:5174'
  )
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({ origin: corsOrigins });

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);

  console.log(`SIMA Training API escuchando en http://localhost:${port}`);
}

void bootstrap();
