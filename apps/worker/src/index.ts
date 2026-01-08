import { Session, Segment, TranscriptionJob } from '@discord-transcribe/shared';
import { TranscriptionQueue } from './transcribe/TranscriptionQueue';
import { TranscriptionService } from './transcribe/TranscriptionService';
import { TimelineMerger } from './merge/TimelineMerger';
import { TranscriptFormatter } from './merge/TranscriptFormatter';
import { v4 as uuidv4 } from 'uuid';

export class TranscriptionWorker {
  private transcriptionService: TranscriptionService;
  private timelineMerger: TimelineMerger;
  private transcriptFormatter: TranscriptFormatter;

  constructor() {
    this.transcriptionService = new TranscriptionService();
    this.timelineMerger = new TimelineMerger();
    this.transcriptFormatter = new TranscriptFormatter();
  }

  /**
   * Process a complete session: transcribe all segments and generate transcript
   * @param session Session data
   * @param segments Array of audio segments
   */
  async processSession(
    session: Session,
    segments: Segment[]
  ): Promise<{
    markdownTranscript: string;
    jsonTranscript: string;
    srtTranscript: string;
  }> {
    console.log(`Processing session ${session.sessionId} with ${segments.length} segments`);

    // Build prompt from glossary
    const prompt = this.transcriptionService.buildPrompt(session.glossary);

    // Create transcription queue
    const queue = new TranscriptionQueue();

    for (const segment of segments) {
      const job: TranscriptionJob = {
        jobId: uuidv4(),
        segmentId: segment.segmentId,
        sessionId: session.sessionId,
        audioPath: segment.audioPath,
        prompt,
        status: 'pending',
        attempts: 0,
        createdAt: Date.now(),
      };

      queue.enqueue(job);
    }

    // Process all transcriptions
    console.log(`Transcribing ${segments.length} segments...`);
    const results = await queue.processQueue(prompt);

    // Update segments with transcripts
    for (const segment of segments) {
      const transcript = results.get(segment.segmentId);
      if (transcript) {
        segment.transcript = transcript;
      }
    }

    // Merge into timeline
    console.log('Merging timeline...');
    const utterances = this.timelineMerger.merge(segments, session);
    const groupedUtterances = this.timelineMerger.groupBySpeaker(utterances);

    // Generate outputs
    console.log('Generating transcript outputs...');
    const markdownTranscript = this.transcriptFormatter.formatMarkdown(groupedUtterances, session);
    const jsonTranscript = this.transcriptFormatter.formatJSON(groupedUtterances, session);
    const srtTranscript = this.transcriptFormatter.formatSRT(groupedUtterances);

    console.log(`Session ${session.sessionId} processing complete`);

    return {
      markdownTranscript,
      jsonTranscript,
      srtTranscript,
    };
  }
}

export * from './transcribe/TranscriptionService';
export * from './transcribe/TranscriptionQueue';
export * from './merge/TimelineMerger';
export * from './merge/TranscriptFormatter';
