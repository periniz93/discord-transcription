import { describe, it, expect } from 'vitest';
import { TimelineMerger } from './TimelineMerger';
import { Segment, Session, SessionState } from '@discord-transcribe/shared';

describe('TimelineMerger', () => {
  const merger = new TimelineMerger();

  const createSession = (): Session => ({
    sessionId: 'test-session',
    guildId: 'guild1',
    voiceChannelId: 'voice1',
    textChannelId: 'text1',
    startedAt: Date.now(),
    state: SessionState.RECORDING,
    participants: new Map([
      ['user1', { userId: 'user1', displayName: 'Alice', consented: true }],
      ['user2', { userId: 'user2', displayName: 'Bob', consented: true }],
    ]),
    glossary: [],
  });

  describe('merge', () => {
    it('should merge segments into chronological timeline', () => {
      const session = createSession();
      const segments: Segment[] = [
        {
          segmentId: 'seg2',
          sessionId: 'test',
          userId: 'user2',
          startMs: 2000,
          endMs: 3000,
          audioPath: '/path2',
          transcript: 'Second utterance',
        },
        {
          segmentId: 'seg1',
          sessionId: 'test',
          userId: 'user1',
          startMs: 0,
          endMs: 1000,
          audioPath: '/path1',
          transcript: 'First utterance',
        },
      ];

      const utterances = merger.merge(segments, session);

      expect(utterances).toHaveLength(2);
      expect(utterances[0].text).toBe('First utterance');
      expect(utterances[0].speakerName).toBe('Alice');
      expect(utterances[1].text).toBe('Second utterance');
      expect(utterances[1].speakerName).toBe('Bob');
    });

    it('should filter out segments without transcripts', () => {
      const session = createSession();
      const segments: Segment[] = [
        {
          segmentId: 'seg1',
          sessionId: 'test',
          userId: 'user1',
          startMs: 0,
          endMs: 1000,
          audioPath: '/path1',
          transcript: 'Valid transcript',
        },
        {
          segmentId: 'seg2',
          sessionId: 'test',
          userId: 'user2',
          startMs: 2000,
          endMs: 3000,
          audioPath: '/path2',
          // No transcript
        },
      ];

      const utterances = merger.merge(segments, session);

      expect(utterances).toHaveLength(1);
      expect(utterances[0].text).toBe('Valid transcript');
    });

    it('should mark overlapping speech', () => {
      const session = createSession();
      const segments: Segment[] = [
        {
          segmentId: 'seg1',
          sessionId: 'test',
          userId: 'user1',
          startMs: 0,
          endMs: 2000, // Ends at 2000
          audioPath: '/path1',
          transcript: 'First',
        },
        {
          segmentId: 'seg2',
          sessionId: 'test',
          userId: 'user2',
          startMs: 1200, // Starts at 1200 (800ms overlap)
          endMs: 3000,
          audioPath: '/path2',
          transcript: 'Second',
        },
      ];

      const utterances = merger.merge(segments, session);

      expect(utterances[0].overlap).toBe(true);
      expect(utterances[1].overlap).toBe(true);
    });

    it('should not mark small overlaps', () => {
      const session = createSession();
      const segments: Segment[] = [
        {
          segmentId: 'seg1',
          sessionId: 'test',
          userId: 'user1',
          startMs: 0,
          endMs: 1000,
          audioPath: '/path1',
          transcript: 'First',
        },
        {
          segmentId: 'seg2',
          sessionId: 'test',
          userId: 'user2',
          startMs: 900, // 100ms overlap (< 500ms threshold)
          endMs: 2000,
          audioPath: '/path2',
          transcript: 'Second',
        },
      ];

      const utterances = merger.merge(segments, session);

      expect(utterances[0].overlap).toBeUndefined();
      expect(utterances[1].overlap).toBeUndefined();
    });

    it('should use default speaker name for unknown user', () => {
      const session = createSession();
      const segments: Segment[] = [
        {
          segmentId: 'seg1',
          sessionId: 'test',
          userId: 'unknown-user',
          startMs: 0,
          endMs: 1000,
          audioPath: '/path1',
          transcript: 'Unknown speaker',
        },
      ];

      const utterances = merger.merge(segments, session);

      expect(utterances[0].speakerName).toBe('User unknown-user');
    });
  });

  describe('groupBySpeaker', () => {
    it('should group consecutive utterances from same speaker', () => {
      const utterances = [
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 0,
          endMs: 1000,
          text: 'First part',
        },
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 1500,
          endMs: 2500,
          text: 'Second part',
        },
      ];

      const grouped = merger.groupBySpeaker(utterances);

      expect(grouped).toHaveLength(1);
      expect(grouped[0].text).toBe('First part Second part');
      expect(grouped[0].startMs).toBe(0);
      expect(grouped[0].endMs).toBe(2500);
    });

    it('should not group different speakers', () => {
      const utterances = [
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 0,
          endMs: 1000,
          text: 'Alice speaks',
        },
        {
          speakerName: 'Bob',
          speakerUserId: 'user2',
          startMs: 1500,
          endMs: 2500,
          text: 'Bob speaks',
        },
      ];

      const grouped = merger.groupBySpeaker(utterances);

      expect(grouped).toHaveLength(2);
      expect(grouped[0].speakerName).toBe('Alice');
      expect(grouped[1].speakerName).toBe('Bob');
    });

    it('should not group if gap is too large', () => {
      const utterances = [
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 0,
          endMs: 1000,
          text: 'First',
        },
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 4000, // 3 second gap
          endMs: 5000,
          text: 'Second',
        },
      ];

      const grouped = merger.groupBySpeaker(utterances);

      expect(grouped).toHaveLength(2);
    });

    it('should not group overlapping utterances', () => {
      const utterances = [
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 0,
          endMs: 1000,
          text: 'First',
          overlap: true,
        },
        {
          speakerName: 'Alice',
          speakerUserId: 'user1',
          startMs: 1500,
          endMs: 2500,
          text: 'Second',
        },
      ];

      const grouped = merger.groupBySpeaker(utterances);

      expect(grouped).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const grouped = merger.groupBySpeaker([]);
      expect(grouped).toEqual([]);
    });
  });
});
