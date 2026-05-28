import { Controller, Get, Param, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('cam-images')
export class DetectionController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get(':ip/:filename')
  serveImage(@Param('ip') ip: string, @Param('filename') filename: string, @Res() res: Response) {
    if (ip.includes('..') || filename.includes('..')) {
      throw new BadRequestException('Invalid path');
    }
    const baseDir = this.config.get<string>('CAM_NOTIFY_DIR', '/home/mmp/camNotify');
    const filePath = path.join(baseDir, ip, filename);
    res.sendFile(filePath);
  }
}
