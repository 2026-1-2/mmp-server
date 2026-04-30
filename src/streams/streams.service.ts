import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { LiveHandler } from './live-handler';
import { VodHandler } from './vod-handler';

interface ChannelState {
  channelId: string;
  live: LiveHandler | null;
  vod: VodHandler | null;
}

@Injectable()
export class StreamsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamsService.name);
  private readonly channels = new Map<string, ChannelState>();

  private readonly recordingsDir: string;
  private readonly hlsOutputDir: string;
  private readonly segmentDuration: number;
  private readonly playlistWindow: number;
  private readonly fileStableMs: number;

  constructor(private readonly config: ConfigService) {
    this.recordingsDir = path.resolve(
      config.get<string>('RECORDINGS_DIR', './recordings'),
    );
    this.hlsOutputDir = path.resolve(
      config.get<string>('HLS_OUTPUT_DIR', './hls'),
    );
    this.segmentDuration = parseInt(
      config.get<string>('SEGMENT_DURATION', '4'),
      10,
    );
    this.playlistWindow = parseInt(
      config.get<string>('PLAYLIST_WINDOW', '6'),
      10,
    );
    this.fileStableMs = parseInt(
      config.get<string>('FILE_STABLE_MS', '500'),
      10,
    );
  }

  onModuleInit() {
    if (!fs.existsSync(this.recordingsDir)) {
      this.logger.warn(`RECORDINGS_DIR not found: ${this.recordingsDir}`);
      return;
    }

    const channelIds = fs
      .readdirSync(this.recordingsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    if (channelIds.length === 0) {
      this.logger.warn(`No channels found in: ${this.recordingsDir}`);
      return;
    }

    for (const id of channelIds) {
      this.initChannel(id);
    }
  }

  onModuleDestroy() {
    for (const { live } of this.channels.values()) {
      live?.stop();
    }
  }

  listChannels() {
    return Array.from(this.channels.values()).map(({ channelId, live, vod }) => ({
      channelId,
      live: live
        ? { playlistUrl: `/streams/${channelId}/live/playlist.m3u8`, status: live.status }
        : null,
      vod: vod ? { listUrl: `/streams/${channelId}/vod` } : null,
    }));
  }

  getLiveHandler(channelId: string): LiveHandler | null {
    return this.channels.get(channelId)?.live ?? null;
  }

  getVodHandler(channelId: string): VodHandler | null {
    return this.channels.get(channelId)?.vod ?? null;
  }

  hasChannel(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  private initChannel(channelId: string) {
    const channelDir = path.join(this.recordingsDir, channelId);
    const liveDir = path.join(channelDir, 'live');
    const vodDir = path.join(channelDir, 'vod');

    let live: LiveHandler | null = null;
    let vod: VodHandler | null = null;

    if (fs.existsSync(liveDir)) {
      const playlistDir = path.join(this.hlsOutputDir, channelId);
      fs.mkdirSync(playlistDir, { recursive: true });
      live = new LiveHandler(
        liveDir,
        path.join(playlistDir, 'playlist.m3u8'),
        this.segmentDuration,
        this.playlistWindow,
        this.fileStableMs,
      );
      live.start();
      this.logger.log(`[${channelId}] Live handler started (${liveDir})`);
    }

    if (fs.existsSync(vodDir)) {
      vod = new VodHandler(vodDir);
      this.logger.log(`[${channelId}] VOD handler ready (${vodDir})`);
    }

    if (live || vod) {
      this.channels.set(channelId, { channelId, live, vod });
    }
  }
}
