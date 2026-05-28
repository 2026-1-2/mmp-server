import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });
  app.useStaticAssets(path.join(__dirname, '..', 'public'));

  const config = new DocumentBuilder()
    .setTitle('MMP Server API')
    .setDescription('Camera management and media streaming API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const adminUsername = process.env.INIT_ADMIN_USERNAME;
  const adminPassword = process.env.INIT_ADMIN_PASSWORD;
  if (adminUsername && adminPassword) {
    const authService = app.get(AuthService);
    await authService.register(adminUsername, adminPassword, 'ADMIN').catch(() => {});
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
