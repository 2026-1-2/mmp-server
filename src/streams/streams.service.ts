import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { VodHandler } from './vod-handler';

@Injectable()
export class StreamsService implements OnModuleInit {
  private readonly logger = new Logger(StreamsService.name);
  private readonly recordingsDir: string;
  private readonly mediamtxHost: string;
  private readonly hlsPort: number;
  private readonly webRtcPort: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.recordingsDir = path.resolve(config.get<string>('RECORDINGS_DIR', './recordings'));
    this.mediamtxHost = config.get<string>('MEDIAMTX_PUBLIC_HOST', 'localhost');
    this.hlsPort = parseInt(config.get<string>('MEDIAMTX_HLS_PORT', '8888'), 10);
    this.webRtcPort = parseInt(config.get<string>('MEDIAMTX_WEBRTC_PORT', '8889'), 10);
  }

  onModuleInit() {
    if (!fs.existsSync(this.recordingsDir)) return;
    for (const dirent of fs.readdirSync(this.recordingsDir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      this.logger.log(`[${dirent.name}] VOD directory found`);
    }
  }

  // ── Session management ────────────────────────────────────────────────────

  async startSession(cameraId: number, userId: number, protocol: 'WEBRTC' | 'HLS') {
    const cam = await this.prisma.camera.findUnique({ where: { camera_id: cameraId } });
    if (!cam) throw new NotFoundException(`Camera ${cameraId} not found`);

    const session = await this.prisma.streamSession.create({
      data: { camera_id: cameraId, user_id: userId, protocol },
    });

    const auth_token = this.jwt.sign(
      { sub: session.session_id, camera_id: cameraId, type: 'stream' },
      { expiresIn: '60s' },
    );

    const endpoint =
      protocol === 'WEBRTC'
        ? `http://${this.mediamtxHost}:${this.webRtcPort}/cam${cameraId}/whep`
        : `http://${this.mediamtxHost}:${this.hlsPort}/cam${cameraId}/index.m3u8`;

    return { session_id: session.session_id, protocol, endpoint, auth_token, expires_in: 60 };
  }

  async stopSession(sessionId: number, userId: number) {
    const session = await this.prisma.streamSession.findUnique({ where: { session_id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.user_id !== userId) throw new ForbiddenException();
    if (session.ended_at) throw new BadRequestException('Session already ended');

    const duration_sec = Math.floor((Date.now() - session.started_at.getTime()) / 1000);
    return this.prisma.streamSession.update({
      where: { session_id: sessionId },
      data: { ended_at: new Date(), duration_sec },
    });
  }

  listSessions(filters: { camera_id?: number; user_id?: number; from?: string; to?: string }) {
    return this.prisma.streamSession.findMany({
      where: {
        ...(filters.camera_id !== undefined && { camera_id: filters.camera_id }),
        ...(filters.user_id !== undefined && { user_id: filters.user_id }),
        ...((filters.from || filters.to) && {
          started_at: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to && { lte: new Date(filters.to) }),
          },
        }),
      },
      orderBy: { started_at: 'desc' },
    });
  }

  listActive() {
    return this.prisma.streamSession.findMany({
      where: { ended_at: null },
      orderBy: { started_at: 'desc' },
    });
  }

  verifyStreamToken(token: string): boolean {
    try {
      const payload = this.jwt.verify<{ type: string }>(token);
      return payload.type === 'stream';
    } catch {
      return false;
    }
  }

  // ── VOD ───────────────────────────────────────────────────────────────────

  getVodHandler(channelId: string): VodHandler | null {
    const dir = path.join(this.recordingsDir, channelId);
    return fs.existsSync(dir) ? new VodHandler(dir) : null;
  }
}
