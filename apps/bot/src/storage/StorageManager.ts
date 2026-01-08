import { config } from '@discord-transcribe/shared';
import { promises as fs } from 'fs';
import * as path from 'path';

export class StorageManager {
  private dataDir: string;

  constructor() {
    this.dataDir = config.storage.dataDir;
  }

  async initialize(): Promise<void> {
    // Create main data directory
    await fs.mkdir(this.dataDir, { recursive: true });

    // Create subdirectories
    await fs.mkdir(path.join(this.dataDir, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'segments'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'transcripts'), { recursive: true });
  }

  getSessionDir(sessionId: string): string {
    return path.join(this.dataDir, 'sessions', sessionId);
  }

  getSessionsRootDir(): string {
    return path.join(this.dataDir, 'sessions');
  }

  getSegmentDir(sessionId: string): string {
    return path.join(this.dataDir, 'segments', sessionId);
  }

  getTranscriptDir(sessionId: string): string {
    return path.join(this.dataDir, 'transcripts', sessionId);
  }

  async createSessionDirectories(sessionId: string): Promise<void> {
    await fs.mkdir(this.getSessionDir(sessionId), { recursive: true });
    await fs.mkdir(this.getSegmentDir(sessionId), { recursive: true });
    await fs.mkdir(this.getTranscriptDir(sessionId), { recursive: true });
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Delete all session data
    await this.deleteDirectory(this.getSessionDir(sessionId));
    await this.deleteDirectory(this.getSegmentDir(sessionId));
    await this.deleteDirectory(this.getTranscriptDir(sessionId));
  }

  private async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error deleting directory ${dirPath}:`, error);
    }
  }

  async cleanupOldSessions(): Promise<void> {
    const retentionMs = config.storage.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    const sessionsDir = path.join(this.dataDir, 'sessions');

    try {
      const sessionDirs = await fs.readdir(sessionsDir);

      for (const sessionId of sessionDirs) {
        const sessionPath = path.join(sessionsDir, sessionId);
        const stats = await fs.stat(sessionPath);

        if (stats.mtimeMs < cutoffTime) {
          console.log(`Cleaning up old session: ${sessionId}`);
          await this.deleteSession(sessionId);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
    }
  }
}
