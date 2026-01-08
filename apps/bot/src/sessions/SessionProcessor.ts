import { SessionState, config } from '@discord-transcribe/shared';
import { SessionManager } from './SessionManager';
import { StorageManager } from '../storage/StorageManager';
import { TranscriptDelivery } from '../storage/TranscriptDelivery';
import { TranscriptionWorker } from '@discord-transcribe/worker';
import { Client } from 'discord.js';
import { Telemetry } from '../monitoring/Telemetry';

export class SessionProcessor {
  private sessionManager: SessionManager;
  private storageManager: StorageManager;
  private transcriptDelivery: TranscriptDelivery;
  private worker: TranscriptionWorker;

  constructor(
    sessionManager: SessionManager,
    storageManager: StorageManager,
    client: Client
  ) {
    this.sessionManager = sessionManager;
    this.storageManager = storageManager;
    this.transcriptDelivery = new TranscriptDelivery(client, storageManager);
    this.worker = new TranscriptionWorker();
  }

  /**
   * Process a stopped session: transcribe and deliver
   * @param sessionId Session ID to process
   */
  async processSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      void Telemetry.record('transcription_started', {
        sessionId: session.sessionId,
        segmentCount: segments.length,
      });
      // Update state
      this.sessionManager.updateSessionState(sessionId, SessionState.TRANSCRIBING);

      // Get segments
      const segments = this.sessionManager.getSegments(sessionId);

      if (segments.length === 0) {
        console.log(`No segments to transcribe for session ${sessionId}`);
        this.sessionManager.updateSessionState(sessionId, SessionState.ERROR);
        return;
      }

      // Process with worker
      const { markdownTranscript, jsonTranscript, srtTranscript } =
        await this.worker.processSession(session, segments);

      // Save transcripts
      const { markdownPath, jsonPath, srtPath } = await this.transcriptDelivery.saveTranscripts(
        session,
        markdownTranscript,
        jsonTranscript,
        srtTranscript
      );

      // Update state
      this.sessionManager.updateSessionState(sessionId, SessionState.DELIVERING);

      // Deliver to Discord (if enabled)
      if (config.delivery.discordEnabled) {
        await this.transcriptDelivery.deliver(session, markdownPath, jsonPath, srtPath);
        console.log(`Transcript delivered to Discord for session ${sessionId}`);
      } else {
        console.log(`Discord delivery disabled. Transcripts saved to disk:`);
        console.log(`  - Markdown: ${markdownPath}`);
        console.log(`  - JSON: ${jsonPath}`);
        if (srtPath) {
          console.log(`  - SRT: ${srtPath}`);
        }
      }

      // Mark as complete
      this.sessionManager.updateSessionState(sessionId, SessionState.IDLE);

      console.log(`Session ${sessionId} processing complete`);
      void Telemetry.record('transcription_completed', {
        sessionId: session.sessionId,
        segmentCount: segments.length,
      });
    } catch (error) {
      console.error(`Error processing session ${sessionId}:`, error);
      void Telemetry.record('transcription_failed', {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.sessionManager.updateSessionState(sessionId, SessionState.ERROR);
      throw error;
    }
  }
}
