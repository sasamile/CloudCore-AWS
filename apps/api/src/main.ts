import './load-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/** Origins permitidos: FRONTEND_URL y/o CORS_ORIGINS (lista separada por comas). */
function corsOrigins(): string | string[] | boolean {
  const list = [
    ...(process.env.CORS_ORIGINS ?? '').split(','),
    process.env.FRONTEND_URL ?? '',
    'http://localhost:3000',
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [...new Set(list)];
  if (unique.length === 0) return true;
  if (unique.length === 1) return unique[0];
  return unique;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();

  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT || 4000);
  console.log(`ZynCloud API running on port ${process.env.PORT || 4000}`);
}
bootstrap();
