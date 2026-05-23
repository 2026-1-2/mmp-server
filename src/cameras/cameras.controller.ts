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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProduces,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CamerasService, CreateCameraDto, UpdateCameraDto } from './cameras.service';

@ApiTags('Cameras')
@ApiBearerAuth()
@Controller('cameras')
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) {}

  @Get()
  @ApiOperation({ summary: '카메라 목록' })
  @ApiQuery({ name: 'zone_id', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['ONLINE', 'OFFLINE'] })
  @ApiQuery({ name: 'ptz_enabled', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'size', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: '페이지네이션된 카메라 목록' })
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
  @ApiOperation({ summary: '카메라 등록' })
  @ApiResponse({ status: 201, description: '등록된 카메라 (rtsp_password 마스킹)' })
  @ApiResponse({ status: 409, description: 'rtsp_url 중복' })
  create(@Body() dto: CreateCameraDto) {
    return this.camerasService.create(dto);
  }

  @Post('health-check-all')
  @ApiOperation({ summary: '전체 카메라 헬스체크' })
  @ApiResponse({ status: 200, description: '전체 카메라 헬스체크 결과 배열' })
  healthCheckAll() {
    return this.camerasService.healthCheckAll();
  }

  @Get(':camera_id')
  @ApiOperation({ summary: '카메라 단건 조회' })
  @ApiParam({ name: 'camera_id', type: Number })
  @ApiResponse({ status: 200, description: '카메라 정보 (rtsp_password 마스킹)' })
  @ApiResponse({ status: 404, description: '카메라 없음' })
  findOne(@Param('camera_id', ParseIntPipe) camera_id: number) {
    return this.camerasService.findOne(camera_id);
  }

  @Patch(':camera_id')
  @ApiOperation({ summary: '카메라 수정' })
  @ApiParam({ name: 'camera_id', type: Number })
  @ApiResponse({ status: 200, description: '수정된 카메라, rtsp_url 변경 시 MediaMTX 동기화' })
  @ApiResponse({ status: 404, description: '카메라 없음' })
  update(
    @Param('camera_id', ParseIntPipe) camera_id: number,
    @Body() dto: UpdateCameraDto,
  ) {
    return this.camerasService.update(camera_id, dto);
  }

  @Delete(':camera_id')
  @ApiOperation({ summary: '카메라 삭제' })
  @ApiParam({ name: 'camera_id', type: Number })
  @ApiResponse({ status: 200, description: '삭제 완료' })
  @ApiResponse({ status: 404, description: '카메라 없음' })
  @ApiResponse({ status: 422, description: '진행 중인 녹화 존재' })
  remove(@Param('camera_id', ParseIntPipe) camera_id: number) {
    return this.camerasService.remove(camera_id);
  }

  @Post(':camera_id/health-check')
  @ApiOperation({ summary: '카메라 헬스체크' })
  @ApiParam({ name: 'camera_id', type: Number })
  @ApiResponse({ status: 200, description: 'TCP 핑 결과, status/last_health_check 갱신 및 system_logs 기록' })
  @ApiResponse({ status: 404, description: '카메라 없음' })
  healthCheck(@Param('camera_id', ParseIntPipe) camera_id: number) {
    return this.camerasService.healthCheck(camera_id);
  }

  @Get(':camera_id/snapshot')
  @ApiOperation({ summary: '카메라 스냅샷' })
  @ApiParam({ name: 'camera_id', type: Number })
  @ApiProduces('image/jpeg')
  @ApiResponse({ status: 200, description: 'JPEG 이미지' })
  @ApiResponse({ status: 404, description: '카메라 없음' })
  @ApiResponse({ status: 503, description: 'ffmpeg 미설치 또는 캡처 실패' })
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
