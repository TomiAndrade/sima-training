import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AccessLogInterceptor } from './observabilidad/access-log.interceptor';
import { CorrelationLogger } from './observabilidad/correlation-logger.service';
import { GlobalExceptionFilter } from './observabilidad/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Reemplaza el logger default apenas se crea la app, para que los logs
    // internos de Nest (incluidos los del propio arranque) también queden
    // prefijados con el requestId. Ver la nota sobre `observabilidad/` sin
    // módulo propio en app.module.ts.
    logger: new CorrelationLogger(),
  });
  const config = app.get(ConfigService);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new AccessLogInterceptor());

  // Los archivos subidos (imágenes de preguntas) ya NO se sirven acá con
  // useStaticAssets: eso sólo sabía leer del disco local, y con R2 el byte no
  // está en esta máquina. Ahora los sirve UploadsController pidiéndoselos a
  // StorageService, así la URL /uploads/* es la misma con cualquier driver.

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
