import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventBusService } from './event-bus.service';
import { SseController } from './sse.controller';
import { DetectionService } from './detection/detection.service';

@Module({
  imports: [AuthModule],
  controllers: [SseController],
  providers: [EventBusService, DetectionService],
  exports: [EventBusService],
})
export class WsModule {}
