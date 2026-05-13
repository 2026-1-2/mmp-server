import { Module } from '@nestjs/common';
import { PtzService } from './ptz.service';
import { PtzController } from './ptz.controller';

@Module({
  providers: [PtzService],
  controllers: [PtzController],
})
export class PtzModule {}
