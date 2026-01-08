import { describe, it, expect, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { TranscriptDelivery } from './TranscriptDelivery';
import { StorageManager } from './StorageManager';
import { Session, SessionState } from '@discord-transcribe/shared';
import type { Client } from 'discord.js';

describe('TranscriptDelivery', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('uploads transcript attachments to a text channel', async () => {
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'transcripts-'));
    tempDirs.push(dir);

    const markdownPath = path.join(dir, 'transcript.md');
    const jsonPath = path.join(dir, 'transcript.json');
    const srtPath = path.join(dir, 'transcript.srt');

    await fs.writeFile(markdownPath, '# Transcript');
    await fs.writeFile(jsonPath, JSON.stringify({}));
    await fs.writeFile(srtPath, '1\n00:00:00,000 --> 00:00:01,000\nHi');

    const sendMock = vi.fn().mockResolvedValue(undefined);
    const channel = {
      isTextBased: () => true,
      send: sendMock,
    };

    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue(channel),
      },
    } as unknown as Client;

    const session: Session = {
      sessionId: 'session-1',
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      startedAt: Date.now() - 10000,
      endedAt: Date.now(),
      state: SessionState.DELIVERING,
      participants: new Map([
        ['user-1', { userId: 'user-1', displayName: 'Alice', consented: true }],
      ]),
      glossary: [],
    };

    const delivery = new TranscriptDelivery(client, new StorageManager());
    await delivery.deliver(session, markdownPath, jsonPath, srtPath);

    expect(sendMock).toHaveBeenCalledOnce();
    const payload = sendMock.mock.calls[0][0];
    expect(payload.files).toHaveLength(3);
  });
});
