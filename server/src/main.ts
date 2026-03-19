import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { bootstrapSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env['FRONTEND_URL'] ?? '',
    credentials: true,
  });
  const port = process.env['PORT'] ?? 3000;
  await bootstrapSwagger(app);
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger documentation running on http://localhost:${port}/docs/swagger`);
}
void bootstrap();
