import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const API_VERSION: string = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'),
).version;

@Injectable()
export class SystemService {
  private readonly mediamtxUrl: string;
  private readonly recordingsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.mediamtxUrl = config.get<string>('MEDIAMTX_URL', 'http://localhost:9997');
    this.recordingsDir = config.get<string>('RECORDINGS_DIR', './recordings');
  }

  async version() {
    const [db, mediamtx] = await Promise.all([
      this.getDbVersion(),
      this.getMediamtxVersion(),
    ]);
    return { data: { api: API_VERSION, db, mediamtx } };
  }

  private async getDbVersion(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ 'VERSION()': string }]>`SELECT VERSION()`;
      return `MySQL ${result[0]['VERSION()']}`;
    } catch {
      return 'ERROR';
    }
  }

  private async getMediamtxVersion(): Promise<string> {
    try {
      const { data } = await axios.get(`${this.mediamtxUrl}/v3/config/global/get`, { timeout: 3000 });
      return data.version ?? 'unknown';
    } catch {
      return 'ERROR';
    }
  }

  async healthCheck() {
    const [db, mediamtx] = await Promise.all([
      this.checkDb(),
      this.checkMediamtx(),
    ]);

    return {
      data: {
        api: 'OK',
        db,
        mediamtx,
        storage: this.checkStorage(),
      },
    };
  }

  private async checkDb(): Promise<'OK' | 'ERROR'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'OK';
    } catch {
      return 'ERROR';
    }
  }

  private async checkMediamtx(): Promise<'OK' | 'ERROR'> {
    try {
      await axios.get(`${this.mediamtxUrl}/v3/paths/list`, { timeout: 3000 });
      return 'OK';
    } catch {
      return 'ERROR';
    }
  }

  private checkStorage(): 'OK' | 'ERROR' {
    try {
      fs.accessSync(this.recordingsDir, fs.constants.R_OK);
      return 'OK';
    } catch {
      return 'ERROR';
    }
  }
}
