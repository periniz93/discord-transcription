/**
 * Session states throughout the recording lifecycle
 */
export enum SessionState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  STOPPING = 'STOPPING',
  TRANSCRIBING = 'TRANSCRIBING',
  DELIVERING = 'DELIVERING',
  ERROR = 'ERROR',
}

/**
 * Core session metadata
 */
export interface Session {
  sessionId: string;
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  startedAt: number; // unix ms
  endedAt?: number;
  state: SessionState;
  participants: Map<string, Participant>;
  glossary: string[];
}

/**
 * Participant in a recording session
 */
export interface Participant {
  userId: string;
  displayName: string;
  consented: boolean;
  referenceClipPath?: string;
}

/**
 * Audio segment from a single speaker
 */
export interface Segment {
  segmentId: string;
  sessionId: string;
  userId: string;
  startMs: number; // relative to session startedAt
  endMs: number;
  audioPath: string;
  transcript?: string;
  tokens?: number;
  confidence?: number;
}

/**
 * Utterance after transcription (normalized atom)
 */
export interface Utterance {
  speakerName: string;
  speakerUserId: string;
  startMs: number;
  endMs: number;
  text: string;
  overlap?: boolean;
  words?: Word[];
}

/**
 * Word-level timestamp (optional)
 */
export interface Word {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Consent record
 */
export interface ConsentRecord {
  guildId: string;
  userId: string;
  consentedAt: number;
}

/**
 * Transcription job
 */
export interface TranscriptionJob {
  jobId: string;
  segmentId: string;
  sessionId: string;
  audioPath: string;
  prompt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  attempts: number;
  createdAt: number;
}
