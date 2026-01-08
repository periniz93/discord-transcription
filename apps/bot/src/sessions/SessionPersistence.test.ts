import { describe, it, expect, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { Session, SessionState, Segment } from '@discord-transcribe/shared';

describe('SessionPersistence', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
    vi.resetModules();
  });

  it('saves and loads sessions with segments', async () => {
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'sessions-'));
    tempDirs.push(dir);
    process.env.DATA_DIR = dir;

    vi.resetModules();
    const { StorageManager } = await import('../storage/StorageManager');
    const { SessionPersistence } = await import('./SessionPersistence');

    const storageManager = new StorageManager();
    await storageManager.initialize();
    const persistence = new SessionPersistence(storageManager);

    const session: Session = {
      sessionId: 'session-1',
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      startedAt: Date.now(),
      state: SessionState.RECORDING,
      participants: new Map([
        ['user-1', { userId: 'user-1', displayName: 'Alice', consented: true }],
      ]),
      glossary: ['Waterdeep'],
    };

    const segments: Segment[] = [
      {
        segmentId: 'segment-1',
        sessionId: 'session-1',
        userId: 'user-1',
        startMs: 0,
        endMs: 1000,
        audioPath: path.join(dir, 'audio.wav'),
      },
    ];

    await persistence.saveSession(session);
    await persistence.saveSegments(session.sessionId, segments);

    const { sessions, segmentsBySession } = await persistence.loadSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('session-1');
    expect(sessions[0].participants.size).toBe(1);
    expect(sessions[0].glossary).toEqual(['Waterdeep']);

    const loadedSegments = segmentsBySession.get('session-1');
    expect(loadedSegments).toHaveLength(1);
    expect(loadedSegments?.[0].segmentId).toBe('segment-1');
  });
});
