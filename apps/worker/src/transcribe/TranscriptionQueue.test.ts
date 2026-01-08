import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TranscriptionResult } from './TranscriptionService';
import { TranscriptionQueue } from './TranscriptionQueue';

const transcribeMock = vi.fn<Promise<TranscriptionResult>, [string, string?]>();

vi.mock('./TranscriptionService', () => {
  class MockTranscriptionError extends Error {
    status?: number;
    retryAfterMs?: number;
    isRateLimit?: boolean;

    constructor(message: string, status?: number, retryAfterMs?: number, isRateLimit?: boolean) {
      super(message);
      this.status = status;
      this.retryAfterMs = retryAfterMs;
      this.isRateLimit = isRateLimit;
    }
  }

  return {
    TranscriptionService: class {
      transcribe = transcribeMock;
    },
    TranscriptionError: MockTranscriptionError,
  };
});

describe('TranscriptionQueue', () => {
  let TranscriptionErrorCtor: new (
    message: string,
    status?: number,
    retryAfterMs?: number,
    isRateLimit?: boolean,
  ) => Error;

  beforeEach(() => {
    transcribeMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries after retry-after when rate limited', async () => {
    ({ TranscriptionError: TranscriptionErrorCtor } = await import('./TranscriptionService'));
    vi.useFakeTimers();
    const queue = new TranscriptionQueue();

    transcribeMock
      .mockRejectedValueOnce(new TranscriptionErrorCtor('rate limited', 429, 2000, true))
      .mockResolvedValueOnce({ text: 'ok' });

    queue.enqueue({
      jobId: 'job1',
      segmentId: 'seg1',
      sessionId: 'session1',
      audioPath: '/tmp/test.wav',
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    });

    const promise = queue.processQueue('prompt');

    await vi.advanceTimersByTimeAsync(1999);
    expect(transcribeMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await promise;

    expect(transcribeMock).toHaveBeenCalledTimes(2);
  });
});
