import { ConsentRecord } from '@discord-transcribe/shared';
import { promises as fs } from 'fs';
import * as path from 'path';

export class ConsentManager {
  private consents: Map<string, ConsentRecord> = new Map();
  private consentFilePath: string;

  constructor(dataDir: string = './data') {
    this.consentFilePath = path.join(dataDir, 'consents.json');
  }

  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.consentFilePath, 'utf-8');
      const records: ConsentRecord[] = JSON.parse(data);
      for (const record of records) {
        const key = this.getKey(record.guildId, record.userId);
        this.consents.set(key, record);
      }
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.consents.clear();
    }
  }

  async save(): Promise<void> {
    const records = Array.from(this.consents.values());
    await fs.writeFile(this.consentFilePath, JSON.stringify(records, null, 2));
  }

  private getKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  hasConsent(guildId: string, userId: string): boolean {
    const key = this.getKey(guildId, userId);
    return this.consents.has(key);
  }

  async grantConsent(guildId: string, userId: string): Promise<void> {
    const key = this.getKey(guildId, userId);
    this.consents.set(key, {
      guildId,
      userId,
      consentedAt: Date.now(),
    });
    await this.save();
  }

  async revokeConsent(guildId: string, userId: string): Promise<void> {
    const key = this.getKey(guildId, userId);
    this.consents.delete(key);
    await this.save();
  }

  getConsent(guildId: string, userId: string): ConsentRecord | undefined {
    const key = this.getKey(guildId, userId);
    return this.consents.get(key);
  }
}
