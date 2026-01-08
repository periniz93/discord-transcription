import { promises as fs } from 'fs';
import * as path from 'path';
import { Session, Segment, Participant } from '@discord-transcribe/shared';
import { StorageManager } from '../storage/StorageManager';

interface PersistedSession {
  sessionId: string;
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  startedAt: number;
  endedAt?: number;
  state: Session['state'];
  participants: Participant[];
  glossary: string[];
}

export class SessionPersistence {
  private storageManager: StorageManager;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
  }

  async saveSession(session: Session): Promise<void> {
    await this.storageManager.createSessionDirectories(session.sessionId);

    const data: PersistedSession = {
      sessionId: session.sessionId,
      guildId: session.guildId,
      voiceChannelId: session.voiceChannelId,
      textChannelId: session.textChannelId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      state: session.state,
      participants: Array.from(session.participants.values()),
      glossary: session.glossary,
    };

    const sessionPath = path.join(
      this.storageManager.getSessionDir(session.sessionId),
      'session.json',
    );
    await fs.writeFile(sessionPath, JSON.stringify(data, null, 2));
  }

  async saveSegments(sessionId: string, segments: Segment[]): Promise<void> {
    await this.storageManager.createSessionDirectories(sessionId);

    const segmentsPath = path.join(
      this.storageManager.getSegmentDir(sessionId),
      'segments.json',
    );
    await fs.writeFile(segmentsPath, JSON.stringify(segments, null, 2));
  }

  async loadSessions(): Promise<{
    sessions: Session[];
    segmentsBySession: Map<string, Segment[]>;
  }> {
    const sessions: Session[] = [];
    const segmentsBySession = new Map<string, Segment[]>();
    const sessionsRoot = this.storageManager.getSessionsRootDir();

    let sessionIds: string[] = [];
    try {
      sessionIds = await fs.readdir(sessionsRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    for (const sessionId of sessionIds) {
      const sessionPath = path.join(
        this.storageManager.getSessionDir(sessionId),
        'session.json',
      );

      try {
        const raw = await fs.readFile(sessionPath, 'utf-8');
        const data = JSON.parse(raw) as PersistedSession;
        const participants = new Map<string, Participant>();
        for (const participant of data.participants) {
          participants.set(participant.userId, participant);
        }

        sessions.push({
          sessionId: data.sessionId,
          guildId: data.guildId,
          voiceChannelId: data.voiceChannelId,
          textChannelId: data.textChannelId,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          state: data.state,
          participants,
          glossary: data.glossary,
        });
      } catch (error) {
        console.warn(`Failed to load session ${sessionId}:`, error);
      }

      const segmentsPath = path.join(
        this.storageManager.getSegmentDir(sessionId),
        'segments.json',
      );
      try {
        const raw = await fs.readFile(segmentsPath, 'utf-8');
        const segments = JSON.parse(raw) as Segment[];
        segmentsBySession.set(sessionId, segments);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`Failed to load segments for ${sessionId}:`, error);
        }
      }
    }

    return { sessions, segmentsBySession };
  }
}
