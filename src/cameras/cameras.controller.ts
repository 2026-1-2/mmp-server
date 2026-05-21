import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CamerasService, CreateCameraDto, UpdateCameraDto } from './cameras.service';

@Controller('cameras')
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) {}

  @Get()
  list(
    @Query('zone_id') zone_id?: string,
    @Query('status') status?: string,
    @Query('ptz_enabled') ptz_enabled?: string,
    @Query('page') page = '1',
    @Query('size') size = '20',
  ) {
    return this.camerasService.list({
      zone_id: zone_id !== undefined ? parseInt(zone_id, 10) : undefined,
      status,
      ptz_enabled: ptz_enabled !== undefined ? ptz_enabled === 'true' : undefined,
      page: parseInt(page, 10),
      size: parseInt(size, 10),
    });
  }

  @Post()
  create(@Body() dto: CreateCameraDto) {
    return this.camerasService.create(dto);
  }

  // health-check-all must be declared before :camera_id routes to avoid param capture
  @Post('health-check-all')
  healthCheckAll() {
    return this.camerasService.healthCheckAll();
  }

  @Get(':camera_id')
  findOne(@Param('camera_id', ParseIntPipe) camera_id: number) {
    return this.camerasService.findOne(camera_id);
  }

  @Patch(':camera_id')
  update(
    @Param('camera_id', ParseIntPipe) camera_id: number,
    @Body() dto: UpdateCameraDto,
  ) {
    return this.camerasService.update(camera_id, dto);
  }

  @Delete(':camera_id')
  remove(@Param('camera_id', ParseIntPipe) camera_id: number) {
    return this.camerasService.remove(camera_id);
  }

  @Post(':camera_id/health-check')
  healthCheck(@Param('camera_id', ParseIntPipe) camera_id: number) {
    return this.camerasService.healthCheck(camera_id);
  }

  @Get(':camera_id/snapshot')
  async snapshot(
    @Param('camera_id', ParseIntPipe) camera_id: number,
    @Res() res: Response,
  ) {
    const buffer = await this.camerasService.snapshot(camera_id);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
