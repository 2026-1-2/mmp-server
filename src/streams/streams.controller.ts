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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { StreamsService } from './streams.service';

const CHANNEL_ID_RE = /^[a-zA-Z0-9_-]+$/;
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
  async registerRtsp(@Body() body: { channelId: string; rtspUrl: string }) {
    if (!CHANNEL_ID_RE.test(body?.channelId ?? ''))
      throw new BadRequestException('Invalid channel ID');
    if (!RTSP_URL_RE.test(body?.rtspUrl ?? ''))
      throw new BadRequestException('rtspUrl must start with rtsp://');
    if (this.streamsService.hasChannel(body.channelId))
      throw new ConflictException(`Channel already registered: ${body.channelId}`);
    const urls = await this.streamsService.registerRtspChannel(body.channelId, body.rtspUrl);
    return { channelId: body.channelId, ...urls };
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
