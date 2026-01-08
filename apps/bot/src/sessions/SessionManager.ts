import { Session, SessionState, Participant, Segment } from '@discord-transcribe/shared';
import { VoiceConnection } from '@discordjs/voice';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
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

  addGlossaryTerm(sessionId: string, term: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (!session.glossary.includes(term)) {
        session.glossary.push(term);
      }
    }
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
