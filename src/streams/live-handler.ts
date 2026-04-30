import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';

export class LiveHandler {
  status: 'starting' | 'live' = 'starting';
  lastSegmentAt: Date | null = null;

  private readonly segments: string[] = [];
  private mediaSequence = 0;
  private watcher: FSWatcher | null = null;

  constructor(
    readonly sourceDir: string,
    readonly playlistPath: string,
    private readonly segmentDuration: number,
    private readonly playlistWindow: number,
    private readonly fileStableMs: number,
  ) {}

  start() {
    const existing = this.getTsFiles();
    const initial = existing.slice(-this.playlistWindow);
    this.segments.push(...initial);
    this.mediaSequence = Math.max(0, existing.length - this.playlistWindow);

    if (this.segments.length > 0) {
      this.writePlaylist();
      this.status = 'live';
      this.lastSegmentAt = new Date();
    }

    this.watcher = chokidar.watch(path.join(this.sourceDir, '*.ts'), {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: this.fileStableMs, pollInterval: 100 },
    });
    this.watcher.on('add', (filePath: string) => this.onNewSegment(filePath));
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
  }

  private getTsFiles(): string[] {
    if (!fs.existsSync(this.sourceDir)) return [];
    return fs
      .readdirSync(this.sourceDir)
      .filter((f) => f.endsWith('.ts'))
      .sort()
      .map((f) => path.join(this.sourceDir, f));
  }

  private onNewSegment(filePath: string) {
    this.segments.push(filePath);
    if (this.segments.length > this.playlistWindow) {
      this.segments.shift();
      this.mediaSequence++;
    }
    this.lastSegmentAt = new Date();
    this.status = 'live';
    this.writePlaylist();
  }

  private writePlaylist() {
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${this.segmentDuration}`,
      `#EXT-X-MEDIA-SEQUENCE:${this.mediaSequence}`,
    ];
    for (const seg of this.segments) {
      lines.push(`#EXTINF:${this.segmentDuration}.0,`);
      lines.push(path.basename(seg));
    }
    fs.writeFileSync(this.playlistPath, lines.join('\n') + '\n');
  }
}
