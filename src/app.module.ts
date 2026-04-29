import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StreamsModule } from './streams/streams.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StreamsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
