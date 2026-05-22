import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StreamsModule } from './streams/streams.module';
import { PtzModule } from './ptz/ptz.module';
import { CamerasModule } from './cameras/cameras.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StreamsModule,
    PtzModule,
    CamerasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
