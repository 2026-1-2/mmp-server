import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MediamtxService {
  private readonly logger = new Logger(MediamtxService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('MEDIAMTX_URL', 'http://localhost:9997');
  }

  async addPath(camId: string, rtspUrl: string): Promise<void> {
    await axios.post(`${this.baseUrl}/v3/config/paths/add/${camId}`, {
      source: rtspUrl,
    });
    this.logger.log(`[${camId}] Added path to mediaMTX`);
  }

  async patchPath(camId: string, rtspUrl: string): Promise<void> {
    await axios.patch(`${this.baseUrl}/v3/config/paths/patch/${camId}`, {
      source: rtspUrl,
    });
    this.logger.log(`[${camId}] Patched path in mediaMTX`);
  }

  async deletePath(camId: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/v3/config/paths/delete/${camId}`);
    this.logger.log(`[${camId}] Deleted path from mediaMTX`);
  }

  async listPaths(): Promise<unknown> {
    const { data } = await axios.get(`${this.baseUrl}/v3/paths/list`);
    return data;
  }

  async listRtspSessions(): Promise<unknown> {
    const { data } = await axios.get(`${this.baseUrl}/v3/rtspsessions/list`);
    return data;
  }
}
