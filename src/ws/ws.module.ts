import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DetectionService } from './detection/detection.service';
import { WsGateway } from './ws.gateway';

@Module({
  imports: [AuthModule],
  providers: [WsGateway, DetectionService],
  exports: [WsGateway],
})
export class WsModule {}
