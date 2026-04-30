import * as fs from 'fs';
import * as path from 'path';

export class VodHandler {
  constructor(readonly sourceDir: string) {}

  listFiles(): string[] {
    if (!fs.existsSync(this.sourceDir)) return [];
    return fs
      .readdirSync(this.sourceDir)
      .filter((f) => f.toLowerCase().endsWith('.mp4'))
      .sort();
  }

  getFilePath(filename: string): string | null {
    const filePath = path.join(this.sourceDir, filename);
    return fs.existsSync(filePath) ? filePath : null;
  }
}
