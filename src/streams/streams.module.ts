import { Module } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { StreamsController } from './streams.controller';
import { MediamtxService } from './mediamtx.service';

@Module({
  providers: [StreamsService, MediamtxService],
  controllers: [StreamsController],
  exports: [MediamtxService],
})
export class StreamsModule {}
