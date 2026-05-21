import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CamerasService, CreateCameraDto } from './cameras.service';

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

  @Get(':camera_id')
  findOne(@Param('camera_id', ParseIntPipe) camera_id: number) {
    return this.camerasService.findOne(camera_id);
  }

  @Post()
  create(@Body() dto: CreateCameraDto) {
    return this.camerasService.create(dto);
  }
}
