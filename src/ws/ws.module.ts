import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusService } from './event-bus.service';
import { SseController } from './sse.controller';
import { DetectionService } from './detection/detection.service';
import { DetectionController } from './detection/detection.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SseController, DetectionController],
  providers: [EventBusService, DetectionService],
  exports: [EventBusService],
})
export class WsModule {}
