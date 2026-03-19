import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export async function bootstrapSwagger(app: INestApplication) {
  app.enableCors({
    origin: process.env['FRONTEND_URL'] ?? '',
    credentials: true,
  });

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Chat API')
    .setDescription('The Department Assistant Chat API documentation')
    .setVersion('1.0')
    .addTag('chat')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs/swagger', app, document);

}

