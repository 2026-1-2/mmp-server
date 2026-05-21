import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as net from 'net';
import { spawn } from 'child_process';
import { MediamtxService } from '../streams/mediamtx.service';

export interface Camera {
  camera_id: number;
  camera_name: string;
  camera_type: string;
  ip_address: string;
  port: number;
  rtsp_url: string;
  rtsp_username: string;
  rtsp_password: string;
  zone_id: number;
  resolution: string;
  fps: number;
  codec: string;
  ptz_enabled: boolean;
  ir_enabled: boolean;
  installed_at: string;
  status: 'ONLINE' | 'OFFLINE';
  last_health_check?: string;
  created_at: string;
}

export interface SystemLog {
  log_id: number;
  camera_id: number;
  event: string;
  status: 'SUCCESS' | 'FAILURE';
  message: string;
  timestamp: string;
}

export class CreateCameraDto {
  @ApiProperty({ example: 'CAM-01 활주로' }) camera_name: string;
  @ApiProperty({ example: 'PTZ', enum: ['PTZ', 'FIXED'] }) camera_type: string;
  @ApiProperty({ example: '192.168.0.101' }) ip_address: string;
  @ApiProperty({ example: 554 }) port: number;
  @ApiProperty({ example: 'rtsp://192.168.0.101:554/stream1' }) rtsp_url: string;
  @ApiProperty({ example: 'admin' }) rtsp_username: string;
  @ApiProperty({ example: 'secret' }) rtsp_password: string;
  @ApiProperty({ example: 1 }) zone_id: number;
  @ApiProperty({ example: '1920x1080' }) resolution: string;
  @ApiProperty({ example: 30 }) fps: number;
  @ApiProperty({ example: 'H.264' }) codec: string;
  @ApiProperty({ example: true }) ptz_enabled: boolean;
  @ApiProperty({ example: true }) ir_enabled: boolean;
  @ApiProperty({ example: '2026-04-15' }) installed_at: string;
}

export class UpdateCameraDto {
  @ApiPropertyOptional({ example: 'CAM-01 수정' }) camera_name?: string;
  @ApiPropertyOptional({ example: 'FIXED', enum: ['PTZ', 'FIXED'] }) camera_type?: string;
  @ApiPropertyOptional({ example: '192.168.0.102' }) ip_address?: string;
  @ApiPropertyOptional({ example: 554 }) port?: number;
  @ApiPropertyOptional({ example: 'rtsp://192.168.0.102:554/stream1' }) rtsp_url?: string;
  @ApiPropertyOptional({ example: 'admin' }) rtsp_username?: string;
  @ApiPropertyOptional({ example: 'newpassword' }) rtsp_password?: string;
  @ApiPropertyOptional({ example: 2 }) zone_id?: number;
  @ApiPropertyOptional({ example: '1280x720' }) resolution?: string;
  @ApiPropertyOptional({ example: 15 }) fps?: number;
  @ApiPropertyOptional({ example: 'H.265' }) codec?: string;
  @ApiPropertyOptional({ example: false }) ptz_enabled?: boolean;
  @ApiPropertyOptional({ example: false }) ir_enabled?: boolean;
  @ApiPropertyOptional({ example: '2026-05-01' }) installed_at?: string;
}

function masked(cam: Camera) {
  return { ...cam, rtsp_password: '****' };
}

function tcpPing(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(false));
    socket.connect(port, host);
  });
}

@Injectable()
export class CamerasService {
  private readonly cameras = new Map<number, Camera>();
  private readonly recordingCameraIds = new Set<number>();
  private readonly systemLogs: SystemLog[] = [];
  private nextId = 1;
  private nextLogId = 1;

  constructor(private readonly mediamtx: MediamtxService) {}

  async create(dto: CreateCameraDto) {
    const duplicate = [...this.cameras.values()].find((c) => c.rtsp_url === dto.rtsp_url);
    if (duplicate) throw new ConflictException(`rtsp_url already registered: ${dto.rtsp_url}`);

    const camera_id = this.nextId++;
    const camera: Camera = {
      ...dto,
      camera_id,
      status: 'ONLINE',
      created_at: new Date().toISOString(),
    };

    await this.mediamtx.addPath(`cam${camera_id}`, dto.rtsp_url);
    this.cameras.set(camera_id, camera);
    return masked(camera);
  }

  list(filters: { zone_id?: number; status?: string; ptz_enabled?: boolean; page: number; size: number }) {
    let items = [...this.cameras.values()];

    if (filters.zone_id !== undefined) items = items.filter((c) => c.zone_id === filters.zone_id);
    if (filters.status !== undefined) items = items.filter((c) => c.status === filters.status);
    if (filters.ptz_enabled !== undefined) items = items.filter((c) => c.ptz_enabled === filters.ptz_enabled);

    const total = items.length;
    const start = (filters.page - 1) * filters.size;
    const data = items.slice(start, start + filters.size).map(masked);

    return { total, page: filters.page, size: filters.size, data };
  }

  findOne(camera_id: number) {
    const cam = this.cameras.get(camera_id);
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);
    return masked(cam);
  }

  async update(camera_id: number, dto: UpdateCameraDto) {
    const cam = this.cameras.get(camera_id);
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);

    const rtspChanged = dto.rtsp_url !== undefined && dto.rtsp_url !== cam.rtsp_url;
    const updated: Camera = { ...cam, ...dto };
    this.cameras.set(camera_id, updated);

    if (rtspChanged) {
      await this.mediamtx.patchPath(`cam${camera_id}`, dto.rtsp_url!);
    }

    return masked(updated);
  }

  async remove(camera_id: number) {
    const cam = this.cameras.get(camera_id);
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);

    if (this.recordingCameraIds.has(camera_id)) {
      throw new UnprocessableEntityException(`Camera ${camera_id} has an active recording`);
    }

    await this.mediamtx.deletePath(`cam${camera_id}`);
    this.cameras.delete(camera_id);
    return { camera_id, deleted: true };
  }

  async healthCheck(camera_id: number) {
    const cam = this.cameras.get(camera_id);
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);

    const reachable = await tcpPing(cam.ip_address, cam.port);
    const now = new Date().toISOString();
    const newStatus: Camera['status'] = reachable ? 'ONLINE' : 'OFFLINE';

    this.cameras.set(camera_id, { ...cam, status: newStatus, last_health_check: now });

    this.systemLogs.push({
      log_id: this.nextLogId++,
      camera_id,
      event: 'HEALTH_CHECK',
      status: reachable ? 'SUCCESS' : 'FAILURE',
      message: reachable ? `${cam.ip_address}:${cam.port} reachable` : `${cam.ip_address}:${cam.port} unreachable`,
      timestamp: now,
    });

    return { camera_id, status: newStatus, last_health_check: now };
  }

  async healthCheckAll() {
    const results = await Promise.all(
      [...this.cameras.keys()].map((id) => this.healthCheck(id)),
    );
    return results;
  }

  async snapshot(camera_id: number): Promise<Buffer> {
    const cam = this.cameras.get(camera_id);
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);

    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', cam.rtsp_url,
        '-vframes', '1',
        '-f', 'image2',
        'pipe:1',
      ]);

      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          reject(new ServiceUnavailableException('ffmpeg not installed'));
        } else {
          reject(err);
        }
      });

      const chunks: Buffer[] = [];
      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new ServiceUnavailableException('ffmpeg failed to capture snapshot'));
        }
      });
    });
  }

  getSystemLogs(camera_id?: number) {
    if (camera_id !== undefined) {
      return this.systemLogs.filter((l) => l.camera_id === camera_id);
    }
    return this.systemLogs;
  }
}
