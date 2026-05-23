import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediamtxService } from './mediamtx.service';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';

@Module({
  imports: [AuthModule],
  providers: [StreamsService, MediamtxService],
  controllers: [StreamsController],
  exports: [MediamtxService],
})
export class StreamsModule {}
