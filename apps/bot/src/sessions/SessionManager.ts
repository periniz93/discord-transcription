import { Session, SessionState, Participant, Segment } from '@discord-transcribe/shared';
import { VoiceConnection } from '@discordjs/voice';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
  private static readonly MAX_GLOSSARY_TERM_LENGTH = 80;
  private sessions: Map<string, Session> = new Map();
  private voiceConnections: Map<string, VoiceConnection> = new Map();
  private segments: Map<string, Segment[]> = new Map(); // sessionId -> segments

  createSession(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string
  ): Session {
    const sessionId = uuidv4();
    const session: Session = {
      sessionId,
      guildId,
      voiceChannelId,
      textChannelId,
      startedAt: Date.now(),
      state: SessionState.IDLE,
      participants: new Map(),
      glossary: [],
    };

    this.sessions.set(sessionId, session);
    this.segments.set(sessionId, []);

    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByGuild(guildId: string): Session | undefined {
    return Array.from(this.sessions.values()).find(
      (s) => s.guildId === guildId && s.state === SessionState.RECORDING
    );
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  updateSessionState(sessionId: string, state: SessionState): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
    }
  }

  addParticipant(sessionId: string, userId: string, displayName: string, consented: boolean): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.participants.set(userId, {
        userId,
        displayName,
        consented,
      });
    }
  }

  removeParticipant(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.participants.delete(userId);
    }
  }

  static normalizeGlossaryTerm(term: string): string | null {
    const cleaned = term
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      return null;
    }

    if (cleaned.length > SessionManager.MAX_GLOSSARY_TERM_LENGTH) {
      return null;
    }

    return cleaned;
  }

  addGlossaryTerm(sessionId: string, term: string): {
    status: 'added' | 'duplicate' | 'invalid';
    term?: string;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { status: 'invalid' };
    }

    const normalized = SessionManager.normalizeGlossaryTerm(term);
    if (!normalized) {
      return { status: 'invalid' };
    }

    if (session.glossary.includes(normalized)) {
      return { status: 'duplicate', term: normalized };
    }

    session.glossary.push(normalized);
    return { status: 'added', term: normalized };
  }

  getGlossary(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? session.glossary : [];
  }

  addSegment(sessionId: string, segment: Segment): void {
    const segments = this.segments.get(sessionId);
    if (segments) {
      segments.push(segment);
    }
  }

  getSegments(sessionId: string): Segment[] {
    return this.segments.get(sessionId) || [];
  }

  setVoiceConnection(sessionId: string, connection: VoiceConnection): void {
    this.voiceConnections.set(sessionId, connection);
  }

  getVoiceConnection(sessionId: string): VoiceConnection | undefined {
    return this.voiceConnections.get(sessionId);
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endedAt = Date.now();
      session.state = SessionState.STOPPING;

      // Clean up voice connection
      const connection = this.voiceConnections.get(sessionId);
      if (connection) {
        connection.destroy();
        this.voiceConnections.delete(sessionId);
      }
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.segments.delete(sessionId);
    this.voiceConnections.delete(sessionId);
  }
}
