import { TranscriptionJob, config } from '@discord-transcribe/shared';
import { TranscriptionService, TranscriptionError, TranscriptionResult } from './TranscriptionService';

export class TranscriptionQueue {
  private service: TranscriptionService;
  private queue: TranscriptionJob[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrency: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private rateLimitUntilMs: number = 0;

  constructor() {
    this.service = new TranscriptionService();
    this.maxConcurrency = config.transcription.concurrency;
    this.maxRetries = config.transcription.maxRetries;
    this.retryDelayMs = config.transcription.retryDelayMs;
  }

  /**
   * Add a job to the queue
   */
  enqueue(job: TranscriptionJob): void {
    this.queue.push(job);
  }

  /**
   * Start processing the queue
   */
  async processQueue(prompt?: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Process jobs with concurrency limit
    const workers: Promise<void>[] = [];

    for (let i = 0; i < this.maxConcurrency; i++) {
      workers.push(this.worker(results, prompt));
    }

    await Promise.all(workers);

    return results;
  }

  private async worker(results: Map<string, string>, prompt?: string): Promise<void> {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        break;
      }

      await this.processJob(job, results, prompt);
    }
  }

  private async processJob(
    job: TranscriptionJob,
    results: Map<string, string>,
    prompt?: string
  ): Promise<void> {
    this.processing.add(job.jobId);
    job.status = 'processing';

    try {
      console.log(`Transcribing segment ${job.segmentId}...`);

      const result = await this.transcribeWithRetry(job.audioPath, prompt);

      job.status = 'completed';
      job.result = result.text;
      results.set(job.segmentId, result.text);

      console.log(`Completed segment ${job.segmentId}`);
    } catch (error) {
      console.error(`Failed to transcribe segment ${job.segmentId}:`, error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      results.set(job.segmentId, ''); // Empty result for failed transcriptions
    } finally {
      this.processing.delete(job.jobId);
    }
  }

  private async transcribeWithRetry(
    audioPath: string,
    prompt?: string,
    attempt: number = 0
  ): Promise<TranscriptionResult> {
    try {
      await this.waitForRateLimit();
      return await this.service.transcribe(audioPath, prompt);
    } catch (error) {
      const delay = this.getRetryDelayMs(error, attempt);
      if (delay !== null && attempt < this.maxRetries - 1) {
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms...`);
        await this.sleep(delay);
        return this.transcribeWithRetry(audioPath, prompt, attempt + 1);
      }
      throw error;
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    if (now < this.rateLimitUntilMs) {
      await this.sleep(this.rateLimitUntilMs - now);
    }
  }

  private getRetryDelayMs(error: unknown, attempt: number): number | null {
    const baseDelay = this.retryDelayMs * Math.pow(2, attempt);

    if (error instanceof TranscriptionError) {
      if (error.retryAfterMs && error.retryAfterMs > 0) {
        this.rateLimitUntilMs = Math.max(this.rateLimitUntilMs, Date.now() + error.retryAfterMs);
        return error.retryAfterMs;
      }

      if (error.isRateLimit || (error.status && error.status >= 500)) {
        return baseDelay;
      }
    }

    return baseDelay;
  }

  private async sleep(durationMs: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, durationMs));
  }

  /**
   * Get queue status
   */
  getStatus(): { pending: number; processing: number } {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
    };
  }
}
