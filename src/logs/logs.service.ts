import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  // 12.1 활동 로그 조회
  listActivity(filters: {
    user_id?: number;
    action_type?: string;
    from?: string;
    to?: string;
    page: number;
    size: number;
  }) {
    const where = {
      ...(filters.user_id !== undefined && { user_id: filters.user_id }),
      ...(filters.action_type && { action_type: filters.action_type }),
      ...((filters.from || filters.to) && {
        created_at: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to && { lte: new Date(filters.to) }),
        },
      }),
    };

    return Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.size,
        take: filters.size,
      }),
      this.prisma.activityLog.count({ where }),
    ]).then(([data, total]) => ({ total, page: filters.page, size: filters.size, data }));
  }

  // 12.2 시스템 로그 조회
  listSystem(filters: {
    log_level?: string;
    source?: string;
    from?: string;
    to?: string;
  }) {
    return this.prisma.infraLog.findMany({
      where: {
        ...(filters.log_level && { log_level: filters.log_level }),
        ...(filters.source && { source: filters.source }),
        ...((filters.from || filters.to) && {
          timestamp: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to && { lte: new Date(filters.to) }),
          },
        }),
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  // 12.3 시스템 로그 적재
  createSystemLog(body: { log_level: string; source: string; message: string; detail?: string }) {
    return this.prisma.infraLog.create({ data: body });
  }

  // 12.4 활동 로그 CSV 내보내기
  async exportActivityCsv(filters: { from?: string; to?: string }): Promise<string> {
    const logs = await this.prisma.activityLog.findMany({
      where: {
        ...((filters.from || filters.to) && {
          created_at: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to && { lte: new Date(filters.to) }),
          },
        }),
      },
      orderBy: { created_at: 'desc' },
    });

    const escape = (v: string | null | undefined) =>
      `"${(v ?? '').replace(/"/g, '""')}"`;

    const header = 'log_id,user_id,action_type,target,detail,created_at';
    const rows = logs.map((l) =>
      [
        l.log_id,
        l.user_id ?? '',
        l.action_type,
        escape(l.target),
        escape(l.detail),
        l.created_at.toISOString(),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
