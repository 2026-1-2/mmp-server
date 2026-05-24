import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';

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
