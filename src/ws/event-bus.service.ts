import { Injectable, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly subject = new Subject<{ type: string; payload: unknown }>();
  readonly events$ = this.subject.asObservable();

  onModuleInit() {
    setInterval(
      () =>
        this.emit('weather.updated', {
          is_flyable: Math.random() > 0.2,
          wind_speed: parseFloat((Math.random() * 12).toFixed(1)),
          temperature: parseFloat((10 + Math.random() * 20).toFixed(1)),
        }),
      10 * 60 * 1000,
    );
  }

  emit(type: string, payload: unknown) {
    this.subject.next({ type, payload });
  }
}
