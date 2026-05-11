import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { VodHandler } from './vod-handler';
import { MediamtxService } from './mediamtx.service';

interface ChannelState {
  channelId: string;
  hlsUrl: string | null;
  webRtcUrl: string | null;
  vod: VodHandler | null;
}

@Injectable()
export class StreamsService implements OnModuleInit {
  private readonly logger = new Logger(StreamsService.name);
  private readonly channels = new Map<string, ChannelState>();

  private readonly recordingsDir: string;
  private readonly mediamtxHost: string;
  private readonly hlsPort: number;
  private readonly webRtcPort: number;

  constructor(
    private readonly config: ConfigService,
    private readonly mediamtx: MediamtxService,
  ) {
    this.recordingsDir = path.resolve(
      config.get<string>('RECORDINGS_DIR', './recordings'),
    );
    const mediamtxUrl = config.get<string>('MEDIAMTX_URL', 'http://localhost:9997');
    this.mediamtxHost = new URL(mediamtxUrl).hostname;
    this.hlsPort = parseInt(config.get<string>('MEDIAMTX_HLS_PORT', '8888'), 10);
    this.webRtcPort = parseInt(config.get<string>('MEDIAMTX_WEBRTC_PORT', '8889'), 10);
  }

  onModuleInit() {
    this.initFromRecordings();
    this.initFromEnvRtsp();
  }

  listChannels() {
    return Array.from(this.channels.values()).map(({ channelId, hlsUrl, webRtcUrl, vod }) => ({
      channelId,
      live: hlsUrl ? { hlsUrl, webRtcUrl } : null,
      vod: vod ? { listUrl: `/streams/${channelId}/vod` } : null,
    }));
  }

  getVodHandler(channelId: string): VodHandler | null {
    return this.channels.get(channelId)?.vod ?? null;
  }

  hasChannel(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  async registerRtspChannel(
    channelId: string,
    rtspUrl: string,
  ): Promise<{ hlsUrl: string; webRtcUrl: string }> {
    await this.mediamtx.addPath(channelId, rtspUrl);
    const hlsUrl = `http://${this.mediamtxHost}:${this.hlsPort}/${channelId}/index.m3u8`;
    const webRtcUrl = `http://${this.mediamtxHost}:${this.webRtcPort}/${channelId}/whep`;
    this.channels.set(channelId, { channelId, hlsUrl, webRtcUrl, vod: null });
    this.logger.log(`[${channelId}] Registered with mediaMTX → HLS: ${hlsUrl}`);
    return { hlsUrl, webRtcUrl };
  }

  private initFromRecordings() {
    if (!fs.existsSync(this.recordingsDir)) {
      this.logger.warn(`RECORDINGS_DIR not found: ${this.recordingsDir}`);
      return;
    }

    const channelIds = fs
      .readdirSync(this.recordingsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const id of channelIds) {
      const vodDir = path.join(this.recordingsDir, id, 'vod');
      if (fs.existsSync(vodDir)) {
        const vod = new VodHandler(vodDir);
        this.channels.set(id, { channelId: id, hlsUrl: null, webRtcUrl: null, vod });
        this.logger.log(`[${id}] VOD handler ready (${vodDir})`);
      }
    }
  }

  private initFromEnvRtsp() {
    const raw = this.config.get<string>('RTSP_CHANNELS', '');
    if (!raw) return;

    let entries: { channelId: string; rtspUrl: string }[];
    try {
      entries = JSON.parse(raw);
    } catch {
      this.logger.error('RTSP_CHANNELS is not valid JSON — skipping');
      return;
    }

    for (const { channelId, rtspUrl } of entries) {
      if (!channelId || !rtspUrl) continue;
      if (this.channels.has(channelId)) {
        this.logger.warn(`[${channelId}] already registered — skipping RTSP_CHANNELS entry`);
        continue;
      }
      this.registerRtspChannel(channelId, rtspUrl).catch((err: Error) =>
        this.logger.error(`[${channelId}] Failed to register with mediaMTX: ${err.message}`),
      );
    }
  }
}
