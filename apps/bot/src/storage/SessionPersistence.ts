import { Session, Segment } from '@discord-transcribe/shared';
import { promises as fs } from 'fs';
import * as path from 'path';

export class SessionPersistence {
  private dataDir: string;
  private sessionsFile: string;
  private segmentsFile: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.sessionsFile = path.join(dataDir, 'sessions.json');
    this.segmentsFile = path.join(dataDir, 'segments.json');
  }

  /**
   * Save sessions to disk
   */
  async saveSessions(sessions: Map<string, Session>): Promise<void> {
    const sessionsArray = Array.from(sessions.values()).map(session => ({
      ...session,
      participants: Array.from(session.participants.entries()),
    }));

    await fs.writeFile(this.sessionsFile, JSON.stringify(sessionsArray, null, 2));
  }

  /**
   * Load sessions from disk
   */
  async loadSessions(): Promise<Map<string, Session>> {
    try {
      const data = await fs.readFile(this.sessionsFile, 'utf-8');
      const sessionsArray = JSON.parse(data);

      const sessions = new Map<string, Session>();
      for (const sessionData of sessionsArray) {
        const session: Session = {
          ...sessionData,
          participants: new Map(sessionData.participants),
        };
        sessions.set(session.sessionId, session);
      }

      return sessions;
    } catch (error) {
      // File doesn't exist or invalid, return empty map
      return new Map();
    }
  }

  /**
   * Save segments to disk
   */
  async saveSegments(segments: Map<string, Segment[]>): Promise<void> {
    const segmentsArray = Array.from(segments.entries());
    await fs.writeFile(this.segmentsFile, JSON.stringify(segmentsArray, null, 2));
  }

  /**
   * Load segments from disk
   */
  async loadSegments(): Promise<Map<string, Segment[]>> {
    try {
      const data = await fs.readFile(this.segmentsFile, 'utf-8');
      const segmentsArray = JSON.parse(data);
      return new Map(segmentsArray);
    } catch (error) {
      // File doesn't exist or invalid, return empty map
      return new Map();
    }
  }
}
