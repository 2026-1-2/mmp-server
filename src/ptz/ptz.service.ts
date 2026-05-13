import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cam } from 'onvif';

interface OnvifCameraConfig {
  cameraId: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
}

@Injectable()
export class PtzService implements OnModuleInit {
  private readonly logger = new Logger(PtzService.name);
  private readonly cameras = new Map<string, Cam>();
  private configs: OnvifCameraConfig[] = [];

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const raw = this.config.get<string>('ONVIF_CAMERAS', '');
    if (!raw) {
      this.logger.warn('ONVIF_CAMERAS not set — PTZ disabled');
      return;
    }

    try {
      this.configs = JSON.parse(raw);
    } catch {
      this.logger.error('ONVIF_CAMERAS is not valid JSON — skipping');
      return;
    }

    for (const cfg of this.configs) {
      try {
        const cam = await this.connectCamera(cfg);
        this.cameras.set(cfg.cameraId, cam);
        this.logger.log(`[${cfg.cameraId}] ONVIF connected (${cfg.hostname}:${cfg.port})`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${cfg.cameraId}] ONVIF connection failed: ${message}`);
      }
    }
  }

  async continuousMove(
    cameraId: string,
    panSpeed: number,
    tiltSpeed: number,
    zoomSpeed: number,
  ): Promise<void> {
    const cam = this.getCam(cameraId);
    await this.promisify<void>((cb) =>
      cam.continuousMove(
        { x: panSpeed, y: tiltSpeed, zoom: zoomSpeed, profileToken: cam.activeSource.profileToken },
        cb,
      ),
    );
  }

  async stop(cameraId: string): Promise<void> {
    const cam = this.getCam(cameraId);
    await this.promisify<void>((cb) =>
      cam.stop({ profileToken: cam.activeSource.profileToken, panTilt: true, zoom: true }, cb),
    );
  }

  async goHome(cameraId: string): Promise<void> {
    const cam = this.getCam(cameraId);
    await this.promisify<void>((cb) =>
      cam.gotoHomePosition({ profileToken: cam.activeSource.profileToken }, cb),
    );
  }

  private getCam(cameraId: string): Cam {
    const cam = this.cameras.get(cameraId);
    if (!cam) {
      throw new NotFoundException(`Camera not found: ${cameraId}`);
    }
    return cam;
  }

  private connectCamera(cfg: OnvifCameraConfig): Promise<Cam> {
    return new Promise((resolve, reject) => {
      const cam = new Cam(
        {
          hostname: cfg.hostname,
          port: cfg.port,
          username: cfg.username,
          password: cfg.password,
        },
        (err?: Error) => {
          if (err) return reject(err);
          resolve(cam);
        },
      );
    });
  }

  private promisify<T>(fn: (cb: (err?: Error, result?: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      fn((err?: Error, result?: T) => {
        if (err) {
          throw new InternalServerErrorException(`ONVIF command failed: ${err.message}`);
        }
        resolve(result as T);
      });
    });
  }
}
