import * as fs from 'fs';
import * as path from 'path';

export interface VodPage {
  files: string[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export class VodHandler {
  constructor(readonly sourceDir: string) {}

  listFiles(): string[] {
    if (!fs.existsSync(this.sourceDir)) return [];
    return fs
      .readdirSync(this.sourceDir)
      .filter((f) => /\.(ts|mp4)$/i.test(f))
      .sort()
      .reverse(); // newest first
  }

  listFilesPaginated(page: number, size: number, date?: string): VodPage {
    let files = this.listFiles();
    if (date) {
      const prefix = date.replace(/-/g, ''); // "2026-05-25" → "20260525"
      files = files.filter((f) => f.startsWith(prefix));
    }
    const total = files.length;
    const totalPages = Math.ceil(total / size) || 1;
    const start = (page - 1) * size;
    return { files: files.slice(start, start + size), total, page, size, totalPages };
  }

  getFilePath(filename: string): string | null {
    const filePath = path.join(this.sourceDir, filename);
    return fs.existsSync(filePath) ? filePath : null;
  }
}
