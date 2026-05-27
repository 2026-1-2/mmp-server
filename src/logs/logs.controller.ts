import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { LogsService } from './logs.service';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('activity')
  @Roles('ADMIN')
  @ApiOperation({ summary: '활동 로그 조회' })
  @ApiQuery({ name: 'user_id', required: false, type: Number })
  @ApiQuery({ name: 'action_type', required: false, type: String, example: 'PTZ_CONTROL' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-01-01T00:00:00Z' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-12-31T23:59:59Z' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'size', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: '페이지네이션된 활동 로그 목록',
    schema: {
      example: {
        total: 120,
        page: 1,
        size: 50,
        data: [
          {
            log_id: 1,
            user_id: 3,
            action_type: 'PTZ_CONTROL',
            target: 'camera:1',
            detail: '{"direction":"left","speed":0.5}',
            created_at: '2026-05-26T10:00:00.000Z',
          },
        ],
      },
    },
  })
  listActivity(
    @Query('user_id') user_id?: string,
    @Query('action_type') action_type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('size') size = '50',
  ) {
    return this.logsService.listActivity({
      user_id: user_id !== undefined ? parseInt(user_id, 10) : undefined,
      action_type,
      from,
      to,
      page: parseInt(page, 10),
      size: parseInt(size, 10),
    });
  }

  @Get('system')
  @Roles('ADMIN')
  @ApiOperation({ summary: '시스템 로그 조회' })
  @ApiQuery({ name: 'log_level', required: false, enum: ['ERROR', 'WARN', 'INFO'] })
  @ApiQuery({ name: 'source', required: false, type: String, example: 'MEDIAMTX' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-01-01T00:00:00Z' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-12-31T23:59:59Z' })
  @ApiResponse({
    status: 200,
    description: '시스템 로그 목록',
    schema: {
      example: [
        {
          log_id: 1,
          log_level: 'ERROR',
          source: 'MEDIAMTX',
          message: 'RTSP 연결 끊김',
          detail: 'cam1 disconnected',
          timestamp: '2026-05-26T10:00:00.000Z',
        },
      ],
    },
  })
  listSystem(
    @Query('log_level') log_level?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.logsService.listSystem({ log_level, source, from, to });
  }

  @Post('system')
  @Roles('OPERATOR')
  @ApiOperation({ summary: '시스템 로그 적재 (내부 컬렉터용)' })
  @ApiBody({
    schema: {
      required: ['log_level', 'source', 'message'],
      properties: {
        log_level: { type: 'string', enum: ['ERROR', 'WARN', 'INFO'], example: 'ERROR' },
        source: { type: 'string', example: 'MEDIAMTX' },
        message: { type: 'string', example: 'RTSP 연결 끊김' },
        detail: { type: 'string', example: 'cam1 stream lost at 10:00:00' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '로그 저장 완료',
    schema: {
      example: {
        log_id: 42,
        log_level: 'ERROR',
        source: 'MEDIAMTX',
        message: 'RTSP 연결 끊김',
        detail: 'cam1 stream lost',
        timestamp: '2026-05-26T10:00:00.000Z',
      },
    },
  })
  createSystemLog(
    @Body() body: { log_level: string; source: string; message: string; detail?: string },
  ) {
    return this.logsService.createSystemLog(body);
  }

  @Get('activity/export')
  @Roles('ADMIN')
  @ApiOperation({ summary: '활동 로그 CSV 내보내기' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-01-01T00:00:00Z' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-12-31T23:59:59Z' })
  @ApiResponse({ status: 200, description: 'CSV 파일 다운로드', content: { 'text/csv': {} } })
  async exportCsv(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.logsService.exportActivityCsv({ from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="activity_logs.csv"');
    res.send(csv);
  }
}
