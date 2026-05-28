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
import { PrismaService } from '../prisma/prisma.service';
// PrismaService extends PrismaClient — model accessors (camera, systemLog) are available directly

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

function masked<T extends { rtsp_password: string }>(cam: T) {
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediamtx: MediamtxService,
  ) {}

  async create(dto: CreateCameraDto) {
    const existing = await this.prisma.camera.findUnique({ where: { rtsp_url: dto.rtsp_url } });
    if (existing) throw new ConflictException(`rtsp_url already registered: ${dto.rtsp_url}`);

    const camera = await this.prisma.camera.create({ data: dto });
    await this.mediamtx.addPath(camera.camera_name, dto.rtsp_url);
    return masked(camera);
  }

  async list(filters: { zone_id?: number; status?: string; ptz_enabled?: boolean; page: number; size: number }) {
    const where = {
      ...(filters.zone_id !== undefined && { zone_id: filters.zone_id }),
      ...(filters.status !== undefined && { status: filters.status }),
      ...(filters.ptz_enabled !== undefined && { ptz_enabled: filters.ptz_enabled }),
    };

    const [total, items] = await Promise.all([
      this.prisma.camera.count({ where }),
      this.prisma.camera.findMany({
        where,
        skip: (filters.page - 1) * filters.size,
        take: filters.size,
        orderBy: { camera_id: 'asc' },
      }),
    ]);

    return { total, page: filters.page, size: filters.size, data: items.map(masked) };
  }

  async findOne(camera_id: number) {
    const cam = await this.prisma.camera.findUnique({ where: { camera_id } });
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);
    return masked(cam);
  }

  async update(camera_id: number, dto: UpdateCameraDto) {
    const cam = await this.prisma.camera.findUnique({ where: { camera_id } });
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);

    const updated = await this.prisma.camera.update({ where: { camera_id }, data: dto });

    if (dto.rtsp_url && dto.rtsp_url !== cam.rtsp_url) {
      await this.mediamtx.patchPath(cam.camera_name, dto.rtsp_url);
    }

    return masked(updated);
  }

  async remove(camera_id: number) {
    const cam = await this.prisma.camera.findUnique({ where: { camera_id } });
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);

    const activeRecording = await this.prisma.systemLog.findFirst({
      where: { camera_id, event: 'RECORDING_START', status: 'SUCCESS' },
    });
    if (activeRecording) {
      throw new UnprocessableEntityException(`Camera ${camera_id} has an active recording`);
    }

    await this.mediamtx.deletePath(cam.camera_name);
    await this.prisma.systemLog.deleteMany({ where: { camera_id } });
    await this.prisma.camera.delete({ where: { camera_id } });
    return { camera_id, deleted: true };
  }

  async healthCheck(camera_id: number) {
    const cam = await this.prisma.camera.findUnique({ where: { camera_id } });
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);

    const reachable = await tcpPing(cam.ip_address, cam.port);
    const newStatus = reachable ? 'ONLINE' : 'OFFLINE';

    const updated = await this.prisma.camera.update({
      where: { camera_id },
      data: { status: newStatus, last_health_check: new Date() },
    });

    await this.prisma.systemLog.create({
      data: {
        camera_id,
        event: 'HEALTH_CHECK',
        status: reachable ? 'SUCCESS' : 'FAILURE',
        message: reachable
          ? `${cam.ip_address}:${cam.port} reachable`
          : `${cam.ip_address}:${cam.port} unreachable`,
      },
    });

    return { camera_id, status: updated.status, last_health_check: updated.last_health_check };
  }

  async healthCheckAll() {
    const cameras = await this.prisma.camera.findMany({ select: { camera_id: true } });
    return Promise.all(cameras.map((c) => this.healthCheck(c.camera_id)));
  }

  async snapshot(camera_id: number): Promise<Buffer> {
    const cam = await this.prisma.camera.findUnique({ where: { camera_id } });
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
        if (err.code === 'ENOENT') reject(new ServiceUnavailableException('ffmpeg not installed'));
        else reject(err);
      });

      const chunks: Buffer[] = [];
      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.on('close', (code) => {
        if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
        else reject(new ServiceUnavailableException('ffmpeg failed to capture snapshot'));
      });
    });
  }
}
