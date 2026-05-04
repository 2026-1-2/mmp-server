import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  NotFoundException,
  BadRequestException,
  ConflictException,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { StreamsService } from './streams.service';

const CHANNEL_ID_RE = /^[a-zA-Z0-9_-]+$/;
const SEGMENT_RE = /^[a-zA-Z0-9_.-]+\.ts$/;
const FILENAME_RE = /^[a-zA-Z0-9_.-]+\.mp4$/i;
const RTSP_URL_RE = /^rtsp:\/\//i;

@Controller('streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  @Get()
  list() {
    return this.streamsService.listChannels();
  }

  @Post('rtsp')
  registerRtsp(@Body() body: { channelId: string; rtspUrl: string }) {
    if (!CHANNEL_ID_RE.test(body?.channelId ?? ''))
      throw new BadRequestException('Invalid channel ID');
    if (!RTSP_URL_RE.test(body?.rtspUrl ?? ''))
      throw new BadRequestException('rtspUrl must start with rtsp://');
    if (this.streamsService.hasChannel(body.channelId))
      throw new ConflictException(`Channel already registered: ${body.channelId}`);
    this.streamsService.registerRtspChannel(body.channelId, body.rtspUrl);
    return {
      channelId: body.channelId,
      playlistUrl: `/streams/${body.channelId}/live/playlist.m3u8`,
    };
  }

  // ── Live ──────────────────────────────────────────────────────────────────

  @Get(':channelId/live/playlist.m3u8')
  playlist(
    @Param('channelId') channelId: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    this.assertChannelId(channelId);
    const live = this.streamsService.getLiveHandler(channelId);
    if (!live) throw new NotFoundException(`No live stream for channel: ${channelId}`);

    if (!fs.existsSync(live.playlistPath)) {
      throw new NotFoundException('Playlist not ready yet — wait for the first TS segment');
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return new StreamableFile(fs.createReadStream(live.playlistPath));
  }

  @Get(':channelId/live/:segment')
  segment(
    @Param('channelId') channelId: string,
    @Param('segment') segment: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    this.assertChannelId(channelId);
    if (!SEGMENT_RE.test(segment)) throw new BadRequestException('Invalid segment name');

    const live = this.streamsService.getLiveHandler(channelId);
    if (!live) throw new NotFoundException(`No live stream for channel: ${channelId}`);

    const filePath = path.join(live.sourceDir, segment);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Segment not found');

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=60, immutable');
    return new StreamableFile(fs.createReadStream(filePath));
  }

  // ── VOD ───────────────────────────────────────────────────────────────────

  @Get(':channelId/vod')
  vodList(@Param('channelId') channelId: string) {
    this.assertChannelId(channelId);
    const vod = this.streamsService.getVodHandler(channelId);
    if (!vod) throw new NotFoundException(`No VOD for channel: ${channelId}`);

    return vod.listFiles().map((filename) => ({
      filename,
      url: `/streams/${channelId}/vod/${filename}`,
    }));
  }

  @Get(':channelId/vod/:filename')
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
    if (!CHANNEL_ID_RE.test(channelId)) {
      throw new BadRequestException('Invalid channel ID');
    }
  }
}
