import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export function maskRtspUrl(url: string): string {
  return url.replace(/^(rtsp:\/\/)[^@]+@/, '$1***:***@');
}

export class RtspHandler {
  status: 'starting' | 'live' | 'error' = 'starting';
  lastSegmentAt: Date | null = null;

  readonly playlistPath: string;
  readonly sourceDir: string;

  private process: ChildProcess | null = null;
  private retries = 0;
  private stopped = false;

  constructor(
    readonly channelId: string,
    private readonly rtspUrl: string,
    readonly hlsDir: string,
    private readonly segmentDuration: number,
    private readonly playlistWindow: number,
  ) {
    this.playlistPath = path.join(hlsDir, 'playlist.m3u8');
    this.sourceDir = hlsDir;
  }

  start() {
    this.stopped = false;
    this.retries = 0;
    this.prepareDir();
    this.spawnFfmpeg();
  }

  stop() {
    this.stopped = true;
    const proc = this.process;
    this.process = null;
    proc?.kill('SIGTERM');
    setTimeout(() => proc?.kill('SIGKILL'), 3000);
  }

  private prepareDir() {
    fs.mkdirSync(this.hlsDir, { recursive: true });
    for (const f of fs.readdirSync(this.hlsDir)) {
      if (f.endsWith('.ts') || f === 'playlist.m3u8') {
        fs.rmSync(path.join(this.hlsDir, f));
      }
    }
  }

  private spawnFfmpeg() {
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', this.rtspUrl,
      '-c:v', 'copy',
      '-c:a', 'aac', '-ac', '2',
      '-map', '0:v',
      '-map', '0:a?',
      '-f', 'hls',
      '-hls_time', String(this.segmentDuration),
      '-hls_list_size', String(this.playlistWindow),
      '-hls_flags', 'delete_segments',
      '-hls_segment_filename', path.join(this.hlsDir, 'seg%05d.ts'),
      '-y',
      this.playlistPath,
    ];

    this.process = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('for writing')) {
        this.status = 'live';
        this.lastSegmentAt = new Date();
      }
    });

    this.process.on('exit', () => {
      if (this.stopped) return;
      this.status = 'starting';
      if (this.retries < MAX_RETRIES) {
        this.retries++;
        setTimeout(() => this.spawnFfmpeg(), RETRY_DELAY_MS);
      } else {
        this.status = 'error';
      }
    });
  }
}
