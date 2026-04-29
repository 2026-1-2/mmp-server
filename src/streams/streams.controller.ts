import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { StreamsService } from './streams.service';

const CHANNEL_ID_RE = /^[a-zA-Z0-9_-]+$/;
const SEGMENT_RE = /^seg_\d{6}\.ts$/;

@Controller('streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  @Get()
  list() {
    return this.streamsService.listChannels();
  }

  @Get(':channelId/status')
  status(@Param('channelId') channelId: string) {
    this.assertChannelId(channelId);
    const result = this.streamsService.getStatus(channelId);
    if (!result) throw new NotFoundException(`Channel not found: ${channelId}`);
    return result;
  }

  @Get(':channelId/playlist.m3u8')
  playlist(
    @Param('channelId') channelId: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    this.assertChannelId(channelId);
    const outputDir = this.streamsService.getChannelOutputDir(channelId);
    if (!outputDir) throw new NotFoundException(`Channel not found: ${channelId}`);

    const filePath = path.join(outputDir, 'playlist.m3u8');
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Playlist not ready yet — wait a few seconds and retry');
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return new StreamableFile(fs.createReadStream(filePath));
  }

  @Get(':channelId/:segment')
  segment(
    @Param('channelId') channelId: string,
    @Param('segment') segment: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    this.assertChannelId(channelId);
    if (!SEGMENT_RE.test(segment)) {
      throw new BadRequestException('Invalid segment name');
    }

    const outputDir = this.streamsService.getChannelOutputDir(channelId);
    if (!outputDir) throw new NotFoundException(`Channel not found: ${channelId}`);

    const filePath = path.join(outputDir, segment);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Segment not found (may have been rolled off)');
    }

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=60, immutable');
    return new StreamableFile(fs.createReadStream(filePath));
  }

  private assertChannelId(channelId: string) {
    if (!CHANNEL_ID_RE.test(channelId)) {
      throw new BadRequestException('Invalid channel ID');
    }
  }
}
