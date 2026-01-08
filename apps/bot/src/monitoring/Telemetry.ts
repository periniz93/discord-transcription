import { promises as fs } from 'fs';
import * as path from 'path';
import { config } from '@discord-transcribe/shared';

export class Telemetry {
  private static logPath(): string {
    return path.join(config.storage.dataDir, 'metrics.log');
  }

  static async record(event: string, data: Record<string, unknown> = {}): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...data,
    };

    await fs.mkdir(config.storage.dataDir, { recursive: true });
    await fs.appendFile(Telemetry.logPath(), `${JSON.stringify(entry)}\n`);
  }
}
