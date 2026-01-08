import { describe, it, expect } from 'vitest';
import { TranscriptFormatter } from './TranscriptFormatter';
import { Utterance, Session, SessionState } from '@discord-transcribe/shared';

describe('TranscriptFormatter', () => {
  const formatter = new TranscriptFormatter();

  const createSession = (): Session => ({
    sessionId: 'test-session-123',
    guildId: 'guild1',
    voiceChannelId: 'voice1',
    textChannelId: 'text1',
    startedAt: 1704672000000, // 2024-01-08 00:00:00
    endedAt: 1704675600000, // 2024-01-08 01:00:00 (1 hour later)
    state: SessionState.IDLE,
    participants: new Map([
      ['user1', { userId: 'user1', displayName: 'Alice', consented: true }],
      ['user2', { userId: 'user2', displayName: 'Bob', consented: true }],
    ]),
    glossary: ['Waterdeep', 'Strahd'],
  });

  const createUtterances = (): Utterance[] => [
    {
      speakerName: 'Alice',
      speakerUserId: 'user1',
      startMs: 0,
      endMs: 2000,
      text: 'Hello everyone!',
    },
    {
      speakerName: 'Bob',
      speakerUserId: 'user2',
      startMs: 2500,
      endMs: 4500,
      text: 'Hi Alice!',
    },
  ];

  describe('formatMarkdown', () => {
    it('should include session metadata in header', () => {
      const session = createSession();
      const utterances = createUtterances();

      const markdown = formatter.formatMarkdown(utterances, session);

      expect(markdown).toContain('# Transcript');
      expect(markdown).toContain('test-session-123');
      expect(markdown).toContain('Alice, Bob');
      expect(markdown).toContain('60m 0s'); // Duration
    });

    it('should format utterances with timestamps', () => {
      const session = createSession();
      const utterances = createUtterances();

      const markdown = formatter.formatMarkdown(utterances, session);

      expect(markdown).toContain('[00:00] Alice');
      expect(markdown).toContain('Hello everyone!');
      expect(markdown).toContain('[00:02] Bob');
      expect(markdown).toContain('Hi Alice!');
    });

    it('should mark overlapping speech', () => {
      const session = createSession();
      const utterances: Utterance[] = [
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 0,
          endMs: 2000,
          text: 'Speaking',
          overlap: true,
        },
      ];

      const markdown = formatter.formatMarkdown(utterances, session);

      expect(markdown).toContain('(overlap)');
    });

    it('should handle empty utterances', () => {
      const session = createSession();
      const markdown = formatter.formatMarkdown([], session);

      expect(markdown).toContain('# Transcript');
      expect(markdown).toContain('test-session-123');
    });
  });

  describe('formatJSON', () => {
    it('should produce valid JSON', () => {
      const session = createSession();
      const utterances = createUtterances();

      const json = formatter.formatJSON(utterances, session);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all session metadata', () => {
      const session = createSession();
      const utterances = createUtterances();

      const json = formatter.formatJSON(utterances, session);
      const data = JSON.parse(json);

      expect(data.sessionId).toBe('test-session-123');
      expect(data.startedAt).toBe(1704672000000);
      expect(data.endedAt).toBe(1704675600000);
      expect(data.participants).toHaveLength(2);
    });

    it('should include all utterances with metadata', () => {
      const session = createSession();
      const utterances = createUtterances();

      const json = formatter.formatJSON(utterances, session);
      const data = JSON.parse(json);

      expect(data.utterances).toHaveLength(2);
      expect(data.utterances[0].speakerName).toBe('Alice');
      expect(data.utterances[0].text).toBe('Hello everyone!');
      expect(data.utterances[0].timestamp).toBe('00:00');
      expect(data.utterances[0].overlap).toBe(false);
    });

    it('should include overlap flag', () => {
      const session = createSession();
      const utterances: Utterance[] = [
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 0,
          endMs: 2000,
          text: 'Text',
          overlap: true,
        },
      ];

      const json = formatter.formatJSON(utterances, session);
      const data = JSON.parse(json);

      expect(data.utterances[0].overlap).toBe(true);
    });
  });

  describe('formatSRT', () => {
    it('should format as valid SRT subtitles', () => {
      const utterances = createUtterances();
      const srt = formatter.formatSRT(utterances);

      expect(srt).toContain('1\n');
      expect(srt).toContain('00:00:00,000 --> 00:00:02,000');
      expect(srt).toContain('Alice: Hello everyone!');
      expect(srt).toContain('2\n');
      expect(srt).toContain('00:00:02,500 --> 00:00:04,500');
      expect(srt).toContain('Bob: Hi Alice!');
    });

    it('should handle hours in timestamps', () => {
      const utterances: Utterance[] = [
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 3661000, // 1:01:01
          endMs: 3662000,
          text: 'After an hour',
        },
      ];

      const srt = formatter.formatSRT(utterances);

      expect(srt).toContain('01:01:01,000 --> 01:01:02,000');
    });

    it('should handle empty utterances', () => {
      const srt = formatter.formatSRT([]);
      expect(srt).toBe('');
    });
  });
});
