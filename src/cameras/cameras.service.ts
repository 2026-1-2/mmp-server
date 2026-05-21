import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  created_at: string;
}

export class CreateCameraDto {
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
}

function masked(cam: Camera) {
  return { ...cam, rtsp_password: '****' };
}

@Injectable()
export class CamerasService {
  private readonly cameras = new Map<number, Camera>();
  private nextId = 1;

  constructor(private readonly mediamtx: MediamtxService) {}

  async create(dto: CreateCameraDto): Promise<ReturnType<typeof masked>> {
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

  findOne(camera_id: number): ReturnType<typeof masked> {
    const cam = this.cameras.get(camera_id);
    if (!cam) throw new NotFoundException(`Camera not found: ${camera_id}`);
    return masked(cam);
  }
}
