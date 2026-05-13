import {
  Controller,
  Post,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { PtzService } from './ptz.service';

const CAMERA_ID_RE = /^[a-zA-Z0-9_-]+$/;

@Controller('ptz')
export class PtzController {
  constructor(private readonly ptzService: PtzService) {}

  @Post(':cameraId/continuous-move')
  async continuousMove(
    @Param('cameraId') cameraId: string,
    @Body() body: { panSpeed: number; tiltSpeed: number; zoomSpeed?: number },
  ) {
    this.validateCameraId(cameraId);

    const { panSpeed, tiltSpeed, zoomSpeed = 0 } = body;
    if (typeof panSpeed !== 'number' || typeof tiltSpeed !== 'number') {
      throw new BadRequestException('panSpeed and tiltSpeed are required numbers');
    }
    if (Math.abs(panSpeed) > 1 || Math.abs(tiltSpeed) > 1 || Math.abs(zoomSpeed) > 1) {
      throw new BadRequestException('Speed values must be between -1 and 1');
    }

    await this.ptzService.continuousMove(cameraId, panSpeed, tiltSpeed, zoomSpeed);
    return { success: true };
  }

  @Post(':cameraId/stop')
  async stop(@Param('cameraId') cameraId: string) {
    this.validateCameraId(cameraId);
    await this.ptzService.stop(cameraId);
    return { success: true };
  }

  @Post(':cameraId/home')
  async goHome(@Param('cameraId') cameraId: string) {
    this.validateCameraId(cameraId);
    await this.ptzService.goHome(cameraId);
    return { success: true };
  }

  private validateCameraId(id: string) {
    if (!CAMERA_ID_RE.test(id)) {
      throw new BadRequestException(`Invalid cameraId format: ${id}`);
    }
  }
}
