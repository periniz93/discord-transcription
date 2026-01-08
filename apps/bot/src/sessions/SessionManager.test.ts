import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './SessionManager';
import { SessionState, Segment } from '@discord-transcribe/shared';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');

      expect(session.sessionId).toBeDefined();
      expect(session.guildId).toBe('guild1');
      expect(session.voiceChannelId).toBe('voice1');
      expect(session.textChannelId).toBe('text1');
      expect(session.state).toBe(SessionState.IDLE);
      expect(session.participants.size).toBe(0);
      expect(session.glossary).toEqual([]);
    });

    it('should create unique session IDs', () => {
      const session1 = sessionManager.createSession('guild1', 'voice1', 'text1');
      const session2 = sessionManager.createSession('guild1', 'voice2', 'text2');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('getSession', () => {
    it('should retrieve session by ID', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      const retrieved = sessionManager.getSession(session.sessionId);

      expect(retrieved).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getSessionByGuild', () => {
    it('should retrieve active recording session by guild', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      sessionManager.updateSessionState(session.sessionId, SessionState.RECORDING);

      const retrieved = sessionManager.getSessionByGuild('guild1');
      expect(retrieved).toBe(session);
    });

    it('should not retrieve non-recording sessions', () => {
      sessionManager.createSession('guild1', 'voice1', 'text1');
      // State is IDLE

      const retrieved = sessionManager.getSessionByGuild('guild1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('participants', () => {
    it('should add participant to session', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      sessionManager.addParticipant(session.sessionId, 'user1', 'Alice', true);

      const participant = session.participants.get('user1');
      expect(participant).toBeDefined();
      expect(participant?.displayName).toBe('Alice');
      expect(participant?.consented).toBe(true);
    });

    it('should remove participant from session', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      sessionManager.addParticipant(session.sessionId, 'user1', 'Alice', true);
      sessionManager.removeParticipant(session.sessionId, 'user1');

      expect(session.participants.has('user1')).toBe(false);
    });
  });

  describe('glossary', () => {
    it('should add terms to glossary', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      sessionManager.addGlossaryTerm(session.sessionId, 'Waterdeep');
      sessionManager.addGlossaryTerm(session.sessionId, 'Strahd');

      expect(session.glossary).toContain('Waterdeep');
      expect(session.glossary).toContain('Strahd');
    });

    it('should not add duplicate terms', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      sessionManager.addGlossaryTerm(session.sessionId, 'Waterdeep');
      sessionManager.addGlossaryTerm(session.sessionId, 'Waterdeep');

      expect(session.glossary.filter(t => t === 'Waterdeep').length).toBe(1);
    });

    it('should normalize whitespace in glossary terms', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      sessionManager.addGlossaryTerm(session.sessionId, '  Eldritch   Blast  ');

      expect(session.glossary).toEqual(['Eldritch Blast']);
    });

    it('should reject overly long glossary terms', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      const longTerm = 'a'.repeat(81);

      const result = sessionManager.addGlossaryTerm(session.sessionId, longTerm);

      expect(result.status).toBe('invalid');
      expect(session.glossary).toEqual([]);
    });

    it('should retrieve glossary', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      sessionManager.addGlossaryTerm(session.sessionId, 'Eldritch Blast');

      const glossary = sessionManager.getGlossary(session.sessionId);
      expect(glossary).toEqual(['Eldritch Blast']);
    });
  });

  describe('segments', () => {
    it('should add segment to session', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      const segment: Segment = {
        segmentId: 'seg1',
        sessionId: session.sessionId,
        userId: 'user1',
        startMs: 0,
        endMs: 1000,
        audioPath: '/path/to/audio.wav',
      };

      sessionManager.addSegment(session.sessionId, segment);

      const segments = sessionManager.getSegments(session.sessionId);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe(segment);
    });

    it('should retrieve empty array for session with no segments', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      const segments = sessionManager.getSegments(session.sessionId);
      expect(segments).toEqual([]);
    });
  });

  describe('stopSession', () => {
    it('should set end time and update state', async () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      const before = Date.now();

      await sessionManager.stopSession(session.sessionId);

      expect(session.endedAt).toBeDefined();
      expect(session.endedAt!).toBeGreaterThanOrEqual(before);
      expect(session.state).toBe(SessionState.STOPPING);
    });
  });

  describe('deleteSession', () => {
    it('should remove session and related data', () => {
      const session = sessionManager.createSession('guild1', 'voice1', 'text1');
      const segment: Segment = {
        segmentId: 'seg1',
        sessionId: session.sessionId,
        userId: 'user1',
        startMs: 0,
        endMs: 1000,
        audioPath: '/path/to/audio.wav',
      };
      sessionManager.addSegment(session.sessionId, segment);

      sessionManager.deleteSession(session.sessionId);

      expect(sessionManager.getSession(session.sessionId)).toBeUndefined();
      expect(sessionManager.getSegments(session.sessionId)).toEqual([]);
    });
  });
});
