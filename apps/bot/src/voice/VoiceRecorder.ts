import {
  VoiceConnection,
  VoiceReceiver,
  EndBehaviorType,
  getVoiceConnection,
} from '@discordjs/voice';
import { Session, Segment, config } from '@discord-transcribe/shared';
import { SessionManager } from '../sessions/SessionManager';
import { StorageManager } from '../storage/StorageManager';
import { AudioProcessor } from './AudioProcessor';
import { RingBuffer } from './RingBuffer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { promises as fs } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

interface ActiveSegment {
  segmentId: string;
  userId: string;
  startMs: number;
  filePath: string;
}

export class VoiceRecorder {
  private session: Session;
  private sessionManager: SessionManager;
  private storageManager: StorageManager;
  private receiver?: VoiceReceiver;
  private ringBuffers: Map<string, RingBuffer> = new Map();
  private activeSegments: Map<string, ActiveSegment> = new Map();
  private audioProcessor: AudioProcessor;

  constructor(
    session: Session,
    sessionManager: SessionManager,
    storageManager: StorageManager
  ) {
    this.session = session;
    this.sessionManager = sessionManager;
    this.storageManager = storageManager;
    this.audioProcessor = new AudioProcessor();
  }

  async start(connection: VoiceConnection): Promise<void> {
    this.receiver = connection.receiver;

    // Subscribe to speaking events
    this.receiver.speaking.on('start', (userId) => {
      this.handleSpeakingStart(userId);
    });
    this.receiver.speaking.on('error', (error: Error) => {
      console.error('Voice receiver speaking error:', error);
    });

    // Start continuous listening for ring buffers
    this.startContinuousListening();

    console.log(`Voice recorder started for session ${this.session.sessionId}`);
  }

  private startContinuousListening(): void {
    if (!this.receiver) {
      return;
    }

    // For each participant, start a continuous stream to feed the ring buffer
    for (const [userId, participant] of this.session.participants.entries()) {
      if (!participant.consented) {
        continue;
      }

      this.startRingBufferFeed(userId);
    }
  }

  private startRingBufferFeed(userId: string): void {
    if (!this.receiver) {
      return;
    }

    const ringBuffer = new RingBuffer(config.audio.preRollMs, config.audio.sampleRate);
    this.ringBuffers.set(userId, ringBuffer);

    // Subscribe to continuous audio for ring buffer
    const continuousStream = this.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.Manual, // Never auto-end
      },
    });
    continuousStream.on('error', (error: Error) => {
      console.error(`Ring buffer stream error for user ${userId}:`, error);
      this.ringBuffers.delete(userId);
    });

    // Decode and feed to ring buffer
    const decoder = new (require('prism-media').opus.Decoder)({
      rate: config.audio.sampleRate,
      channels: config.audio.channels,
      frameSize: 960,
    });

    continuousStream
      .pipe(decoder)
      .on('data', (chunk: Buffer) => {
        const durationMs = (chunk.length / 2 / config.audio.sampleRate) * 1000;
        ringBuffer.add(chunk, durationMs);
      })
      .on('error', (err: Error) => {
        console.error(`Ring buffer feed error for user ${userId}:`, err);
      });
  }

  private async handleSpeakingStart(userId: string): Promise<void> {
    // Dedupe guard: only allow one active segment per user
    if (this.activeSegments.has(userId)) {
      return;
    }

    // Check if user is a participant
    const participant = this.session.participants.get(userId);
    if (!participant || !participant.consented) {
      return;
    }

    console.log(`Starting segment for user ${userId} (${participant.displayName})`);

    try {
      await this.recordSegment(userId, participant.displayName);
    } catch (error) {
      console.error(`Error recording segment for user ${userId}:`, error);
      this.activeSegments.delete(userId);
    }
  }

  private async recordSegment(userId: string, displayName: string): Promise<void> {
    if (!this.receiver) {
      return;
    }

    const segmentId = uuidv4();
    const segmentDir = this.storageManager.getSegmentDir(this.session.sessionId);
    const fileName = `${segmentId}_${userId}_${displayName.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
    const filePath = path.join(segmentDir, fileName);

    // Get or create ring buffer for this user
    let ringBuffer = this.ringBuffers.get(userId);
    if (!ringBuffer) {
      ringBuffer = new RingBuffer(config.audio.preRollMs, config.audio.sampleRate);
      this.ringBuffers.set(userId, ringBuffer);
    }

    // Calculate actual start time with pre-roll
    const preRollMs = ringBuffer.getDurationMs();
    const startMs = Date.now() - this.session.startedAt - preRollMs;

    // Mark as active
    this.activeSegments.set(userId, {
      segmentId,
      userId,
      startMs,
      filePath,
    });

    // Subscribe to user's audio stream
    const audioStream = this.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: config.audio.silenceDurationMs,
      },
    });
    audioStream.on('error', (error: Error) => {
      console.error(`Audio stream error for user ${userId}:`, error);
    });

    try {
      // Process and save audio
      await this.audioProcessor.processAndSave(
        audioStream,
        filePath,
        ringBuffer.getBuffer()
      );

      // Calculate end time
      const endMs = Date.now() - this.session.startedAt;

      // Create segment record
      const segment: Segment = {
        segmentId,
        sessionId: this.session.sessionId,
        userId,
        startMs,
        endMs,
        audioPath: filePath,
      };

      this.sessionManager.addSegment(this.session.sessionId, segment);

      console.log(
        `Segment recorded: ${segmentId} for ${displayName} (${endMs - startMs}ms)`
      );
    } catch (error) {
      console.error(`Error processing audio for segment ${segmentId}:`, error);
      await fs.rm(filePath, { force: true });
    } finally {
      // Remove from active segments
      this.activeSegments.delete(userId);
    }
  }

  stop(): void {
    // Clear all active streams
    this.activeSegments.clear();
    this.ringBuffers.clear();

    console.log(`Voice recorder stopped for session ${this.session.sessionId}`);
  }
}
