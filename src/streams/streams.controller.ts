import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { StreamsService } from './streams.service';

const CHANNEL_ID_RE = /^[a-zA-Z0-9_-]+$/;
const FILENAME_RE = /^[a-zA-Z0-9_.-]+\.mp4$/i;

@ApiTags('Streams')
@ApiBearerAuth()
@Controller('streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  // ── Live session ──────────────────────────────────────────────────────────

  @Post('live/:camera_id/start')
  @Roles('VIEWER')
  @ApiOperation({ summary: '라이브 스트림 시작 (시청 토큰 발급)' })
  @ApiParam({ name: 'camera_id', type: Number })
  @ApiBody({
    schema: {
      properties: { protocol: { type: 'string', enum: ['WEBRTC', 'HLS'], default: 'WEBRTC' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: '세션 ID, MediaMTX 엔드포인트 URL, 60초짜리 스트림 토큰 반환',
    schema: {
      example: {
        session_id: 1023,
        protocol: 'WEBRTC',
        endpoint: 'http://localhost:8889/cam1/whep',
        auth_token: 'eyJhbGci...',
        expires_in: 60,
      },
    },
  })
  @ApiResponse({ status: 404, description: '카메라 없음' })
  startSession(
    @Param('camera_id', ParseIntPipe) camera_id: number,
    @Body('protocol') protocol: 'WEBRTC' | 'HLS' = 'WEBRTC',
    @Req() req: Request & { user: { user_id: number } },
  ) {
    return this.streamsService.startSession(camera_id, req.user.user_id, protocol);
  }

  @Post('live/:session_id/stop')
  @Roles('VIEWER')
  @ApiOperation({ summary: '라이브 스트림 종료' })
  @ApiParam({ name: 'session_id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'ended_at, duration_sec 기록',
    schema: {
      example: {
        session_id: 1023,
        camera_id: 1,
        user_id: 5,
        protocol: 'WEBRTC',
        started_at: '2026-05-23T10:00:00.000Z',
        ended_at: '2026-05-23T10:03:42.000Z',
        duration_sec: 222,
      },
    },
  })
  @ApiResponse({ status: 400, description: '이미 종료된 세션' })
  @ApiResponse({ status: 403, description: '본인 세션이 아님' })
  @ApiResponse({ status: 404, description: '세션 없음' })
  stopSession(
    @Param('session_id', ParseIntPipe) session_id: number,
    @Req() req: Request & { user: { user_id: number } },
  ) {
    return this.streamsService.stopSession(session_id, req.user.user_id);
  }

  @Get('sessions')
  @Roles('ADMIN')
  @ApiOperation({ summary: '스트림 세션 목록 (관제)' })
  @ApiQuery({ name: 'camera_id', required: false, type: Number, description: '카메라 ID 필터' })
  @ApiQuery({ name: 'user_id', required: false, type: Number, description: '사용자 ID 필터' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-01-01T00:00:00Z', description: '시작 시각 (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-12-31T23:59:59Z', description: '종료 시각 (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: '세션 목록 (started_at 내림차순)',
    schema: {
      example: [
        {
          session_id: 1023,
          camera_id: 1,
          user_id: 5,
          protocol: 'WEBRTC',
          started_at: '2026-05-23T10:00:00.000Z',
          ended_at: '2026-05-23T10:03:42.000Z',
          duration_sec: 222,
        },
      ],
    },
  })
  listSessions(
    @Query('camera_id') camera_id?: string,
    @Query('user_id') user_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.streamsService.listSessions({
      camera_id: camera_id !== undefined ? parseInt(camera_id, 10) : undefined,
      user_id: user_id !== undefined ? parseInt(user_id, 10) : undefined,
      from,
      to,
    });
  }

  @Get('active')
  @Roles('OPERATOR')
  @ApiOperation({ summary: '활성 스트림 현황' })
  @ApiResponse({
    status: 200,
    description: '현재 시청 중인 세션 목록 (ended_at이 null인 세션)',
    schema: {
      example: [
        {
          session_id: 1024,
          camera_id: 2,
          user_id: 3,
          protocol: 'HLS',
          started_at: '2026-05-23T10:05:00.000Z',
          ended_at: null,
          duration_sec: null,
        },
      ],
    },
  })
  listActive() {
    return this.streamsService.listActive();
  }

  // ── MediaMTX auth webhook ─────────────────────────────────────────────────

  @Post('mediamtx-auth')
  @Public()
  @ApiOperation({
    summary: 'MediaMTX 토큰 검증 웹훅 (내부용)',
    description: 'MediaMTX가 클라이언트 연결 시 자동 호출. 직접 사용 불필요.',
  })
  @ApiBody({ schema: { example: { query: 'token=eyJhbGci...' } } })
  @ApiResponse({ status: 200, description: '토큰 유효' })
  @ApiResponse({ status: 401, description: '토큰 무효 또는 만료' })
  mediamtxAuth(@Body() body: { query?: string }) {
    const token = new URLSearchParams(body.query ?? '').get('token') ?? '';
    if (!this.streamsService.verifyStreamToken(token)) {
      throw new UnauthorizedException();
    }
    return { ok: true };
  }

  // ── VOD ───────────────────────────────────────────────────────────────────

  @Get(':channelId/vod')
  @Roles('VIEWER')
  @ApiOperation({ summary: 'VOD 파일 목록 (페이지네이션)' })
  @ApiParam({ name: 'channelId', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호 (기본 1)' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: '페이지 크기 (기본 10, 최대 100)' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-05-25', description: '날짜 필터 (YYYY-MM-DD)' })
  vodList(
    @Param('channelId') channelId: string,
    @Query('page') page = '1',
    @Query('size') size = '10',
    @Query('date') date?: string,
  ) {
    this.assertChannelId(channelId);
    const vod = this.streamsService.getVodHandler(channelId);
    if (!vod) throw new NotFoundException(`No VOD for channel: ${channelId}`);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const sizeNum = Math.min(100, Math.max(1, parseInt(size, 10) || 10));
    const result = vod.listFilesPaginated(pageNum, sizeNum, date);
    return {
      ...result,
      files: result.files.map((filename) => ({
        filename,
        url: `/streams/${channelId}/vod/${filename}`,
      })),
    };
  }

  @Get(':channelId/vod/:filename')
  @Roles('VIEWER')
  @ApiOperation({ summary: 'VOD 파일 스트리밍' })
  @ApiParam({ name: 'channelId', type: String })
  @ApiParam({ name: 'filename', type: String })
  vodFile(
    @Param('channelId') channelId: string,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.assertChannelId(channelId);
    if (!FILENAME_RE.test(filename)) throw new BadRequestException('Invalid filename');

    const vod = this.streamsService.getVodHandler(channelId);
    if (!vod) throw new NotFoundException(`No VOD for channel: ${channelId}`);

    const filePath = vod.getFilePath(filename);
    if (!filePath) throw new NotFoundException(`File not found: ${filename}`);

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', 'video/mp4');
      res.status(206);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
      fs.createReadStream(filePath).pipe(res);
    }
  }

  private assertChannelId(channelId: string) {
    if (!CHANNEL_ID_RE.test(channelId)) throw new BadRequestException('Invalid channel ID');
  }
}
