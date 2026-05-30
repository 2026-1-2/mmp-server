import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, size: number) {
    const [total, data] = await Promise.all([
      this.prisma.detectionEvent.count(),
      this.prisma.detectionEvent.findMany({
        skip: (page - 1) * size,
        take: size,
        orderBy: { detected_at: 'desc' },
      }),
    ]);
    return { total, page, size, data };
  }
}
