import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as chokidar from 'chokidar';
import * as path from 'path';
import { EventBusService } from '../event-bus.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DetectionService implements OnModuleInit {
  private readonly logger = new Logger(DetectionService.name);
  private readonly watchDir: string;

  constructor(
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.watchDir = this.config.get<string>('CAM_NOTIFY_DIR', '/home/mmp/camNotify');
  }

  onModuleInit() {
    chokidar
      .watch(path.join(this.watchDir, '**', '*.jpg'), {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
      })
      .on('add', (filePath: string) => {
        this.processFile(filePath).catch((err: unknown) => {
          this.logger.error(`Failed to process ${filePath}: ${(err as Error).message}`);
        });
      });

    this.logger.log(`Watching for detections in ${this.watchDir}`);
  }

  private async processFile(filePath: string) {
    const cameraIp = path.basename(path.dirname(filePath));
    const cam = await this.prisma.camera.findFirst({ where: { ip_address: cameraIp } });

    const saved = await this.prisma.detectionEvent.create({
      data: {
        camera_id: cam?.camera_id ?? null,
        camera_ip: cameraIp,
        image_url: `/cam-images/${cameraIp}/${path.basename(filePath)}`,
        severity: 'CRITICAL',
      },
    });

    this.eventBus.emit('event.created', {
      event_id: saved.event_id,
      camera_id: saved.camera_id,
      camera_ip: saved.camera_ip,
      image_url: saved.image_url,
      detected_at: saved.detected_at.toISOString(),
      severity: saved.severity,
    });

    this.logger.log(`[${cameraIp}] Detection image: ${path.basename(filePath)}`);
  }
}
