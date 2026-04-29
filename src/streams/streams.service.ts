import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import ffmpeg from 'fluent-ffmpeg';
import type { FfmpegCommand } from 'fluent-ffmpeg';
import type { FSWatcher } from 'chokidar';

interface ChannelState {
  channelId: string;
  sourceDir: string;
  outputDir: string;
  status: 'starting' | 'live' | 'error';
  process: FfmpegCommand | null;
  watcher: FSWatcher | null;
  currentFile: string | null;
  lastSegmentAt: Date | null;
  restartCount: number;
  startedAt: Date;
  restartTimer: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class StreamsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamsService.name);
  private readonly channels = new Map<string, ChannelState>();

  private readonly recordingsDir: string;
  private readonly hlsOutputDir: string;
  private readonly segmentDuration: number;
  private readonly playlistWindow: number;
  private readonly restartDebounceMs: number;
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
    this.restartDebounceMs = parseInt(
      config.get<string>('RESTART_DEBOUNCE_MS', '2000'),
      10,
    );
    this.fileStableMs = parseInt(
      config.get<string>('FILE_STABLE_MS', '500'),
      10,
    );

    const ffmpegPath = config.get<string>('FFMPEG_PATH');
    if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
  }

  async onModuleInit() {
    const channelIds = this.discoverChannels();
    if (channelIds.length === 0) {
      this.logger.warn(
        `No channels found. Add subdirectories with MP4 files to: ${this.recordingsDir}`,
      );
      return;
    }
    for (const id of channelIds) {
      this.initChannel(id);
    }
  }

  onModuleDestroy() {
    for (const state of this.channels.values()) {
      this.stopChannel(state);
    }
  }

  listChannels() {
    return Array.from(this.channels.values()).map((s) => ({
      channelId: s.channelId,
      playlistUrl: `/streams/${s.channelId}/playlist.m3u8`,
      status: s.status,
    }));
  }

  getStatus(channelId: string) {
    const state = this.channels.get(channelId);
    if (!state) return null;
    return {
      channelId: state.channelId,
      status: state.status,
      lastSegmentAt: state.lastSegmentAt,
      currentFile: state.currentFile ? path.basename(state.currentFile) : null,
      restartCount: state.restartCount,
      uptimeSec: Math.floor((Date.now() - state.startedAt.getTime()) / 1000),
    };
  }

  getChannelOutputDir(channelId: string): string | null {
    return this.channels.get(channelId)?.outputDir ?? null;
  }

  hasChannel(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  private discoverChannels(): string[] {
    const envIds = this.config.get<string>('CHANNEL_IDS');
    if (envIds) {
      return envIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (!fs.existsSync(this.recordingsDir)) {
      this.logger.warn(`RECORDINGS_DIR not found: ${this.recordingsDir}`);
      return [];
    }
    return fs
      .readdirSync(this.recordingsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  private initChannel(channelId: string) {
    const sourceDir = path.join(this.recordingsDir, channelId);
    const outputDir = path.join(this.hlsOutputDir, channelId);
    fs.mkdirSync(outputDir, { recursive: true });

    const state: ChannelState = {
      channelId,
      sourceDir,
      outputDir,
      status: 'starting',
      process: null,
      watcher: null,
      currentFile: null,
      lastSegmentAt: null,
      restartCount: 0,
      startedAt: new Date(),
      restartTimer: null,
    };
    this.channels.set(channelId, state);

    const mp4s = this.getMp4Files(sourceDir);
    if (mp4s.length > 0) {
      this.startFfmpeg(state, mp4s[mp4s.length - 1]);
    } else {
      this.logger.log(`[${channelId}] No MP4 files yet, watching for new files...`);
    }

    this.startWatcher(state);
  }

  private getMp4Files(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.mp4'))
      .map((f) => path.join(dir, f))
      .sort(
        (a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs,
      );
  }

  private startFfmpeg(state: ChannelState, inputFile: string) {
    const { channelId, outputDir } = state;

    // Clean up stale segments from previous run
    if (fs.existsSync(outputDir)) {
      fs.readdirSync(outputDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.m3u8'))
        .forEach((f) => {
          try {
            fs.unlinkSync(path.join(outputDir, f));
          } catch {}
        });
    }

    state.currentFile = inputFile;
    state.status = 'starting';

    const playlistPath = path.join(outputDir, 'playlist.m3u8');
    const segmentPattern = path.join(outputDir, 'seg_%06d.ts');

    this.logger.log(`[${channelId}] Starting stream: ${path.basename(inputFile)}`);

    const useReencode = this.config.get<string>('FFMPEG_REENCODE') === 'true';

    const cmd = ffmpeg()
      .input(inputFile)
      .inputOptions(['-stream_loop', '-1', '-re'])
      .outputOptions([
        useReencode ? '-c:v libx264' : '-c copy',
        ...(useReencode ? ['-preset veryfast', '-c:a aac'] : []),
        '-f hls',
        '-hls_time', String(this.segmentDuration),
        '-hls_list_size', String(this.playlistWindow),
        '-hls_flags', 'delete_segments+omit_endlist+independent_segments',
        '-hls_segment_filename', segmentPattern,
      ])
      .output(playlistPath);

    cmd.on('start', (cmdLine: string) => {
      this.logger.debug(`[${channelId}] ${cmdLine}`);
    });

    cmd.on('stderr', (line: string) => {
      if (line.includes('.ts') && line.includes('Opening')) {
        state.status = 'live';
        state.lastSegmentAt = new Date();
      }
    });

    cmd.on('error', (err: Error) => {
      const msg = err.message ?? '';
      if (msg.includes('SIGTERM') || msg.includes('killed')) return;
      this.logger.error(`[${channelId}] ffmpeg error: ${msg}`);
      state.status = 'error';
    });

    cmd.on('end', () => {
      // Should not happen with -stream_loop -1, but guard anyway
      this.logger.warn(`[${channelId}] ffmpeg ended unexpectedly`);
    });

    cmd.run();
    state.process = cmd;

    // Fallback: mark live after segment_duration*2 seconds if not detected via stderr
    setTimeout(() => {
      if (state.status === 'starting' && state.process === cmd) {
        const segments = fs.existsSync(outputDir)
          ? fs.readdirSync(outputDir).filter((f) => f.endsWith('.ts'))
          : [];
        if (segments.length > 0) {
          state.status = 'live';
          state.lastSegmentAt = new Date();
        }
      }
    }, this.segmentDuration * 2 * 1000);
  }

  private startWatcher(state: ChannelState) {
    const { channelId, sourceDir } = state;

    const watcher = chokidar.watch(`${sourceDir}/*.mp4`, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.fileStableMs,
        pollInterval: 100,
      },
    });

    watcher.on('add', (filePath: string) => {
      this.logger.log(
        `[${channelId}] New file: ${path.basename(filePath)}`,
      );
      this.scheduleRestart(state, filePath);
    });

    watcher.on('error', (err: unknown) => {
      this.logger.error(`[${channelId}] Watcher error: ${err}`);
    });

    state.watcher = watcher;
  }

  private scheduleRestart(state: ChannelState, newFile: string) {
    if (state.restartTimer) clearTimeout(state.restartTimer);
    state.restartTimer = setTimeout(() => {
      state.restartTimer = null;
      this.killFfmpeg(state);
      state.restartCount++;
      this.startFfmpeg(state, newFile);
    }, this.restartDebounceMs);
  }

  private killFfmpeg(state: ChannelState) {
    if (state.process) {
      try {
        state.process.kill('SIGTERM');
      } catch {}
      state.process = null;
    }
  }

  private stopChannel(state: ChannelState) {
    if (state.restartTimer) clearTimeout(state.restartTimer);
    this.killFfmpeg(state);
    if (state.watcher) {
      void state.watcher.close();
      state.watcher = null;
    }
  }
}
