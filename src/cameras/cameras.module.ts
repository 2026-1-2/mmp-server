import { Module } from '@nestjs/common';
import { CamerasController } from './cameras.controller';
import { CamerasService } from './cameras.service';
import { StreamsModule } from '../streams/streams.module';

@Module({
  imports: [StreamsModule],
  controllers: [CamerasController],
  providers: [CamerasService],
})
export class CamerasModule {}
