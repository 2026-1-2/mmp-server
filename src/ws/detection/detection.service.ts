import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { EventBusService } from '../event-bus.service';

function parseField(xml: string, field: string): string {
  const match = xml.match(new RegExp(`<${field}>([^<]+)</${field}>`));
  return match?.[1]?.trim() ?? '';
}

@Injectable()
export class DetectionService implements OnModuleInit {
  private readonly logger = new Logger(DetectionService.name);
  private readonly watchDir = path.join(__dirname, 'sample');

  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit() {
    if (!fs.existsSync(this.watchDir)) {
      this.logger.warn(`Detection watch dir not found: ${this.watchDir}`);
      return;
    }

    chokidar.watch(path.join(this.watchDir, '*.xml'), { ignoreInitial: true }).on(
      'change',
      (filePath: string) => {
        try {
          this.processFile(filePath);
        } catch (err: unknown) {
          this.logger.error(`Failed to process ${filePath}: ${(err as Error).message}`);
        }
      },
    );

    this.logger.log(`Watching for detections in ${this.watchDir}`);
  }

  private processFile(filePath: string) {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const cameraId = parseInt(parseField(xml, 'camera_id'), 10);
    const objectType = parseField(xml, 'object_type');
    const confidence = parseFloat(parseField(xml, 'confidence'));
    const severity = confidence >= 0.9 ? 'CRITICAL' : 'WARNING';

    this.eventBus.emit('event.created', {
      event_id: Date.now(),
      camera_id: cameraId,
      severity,
      object_type: objectType,
      confidence,
      detected_at: new Date().toISOString(),
    });

    this.logger.log(`[cam${cameraId}] Detection: ${objectType} (${confidence})`);
  }
}
