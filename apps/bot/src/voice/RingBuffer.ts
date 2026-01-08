/**
 * Ring buffer for pre-roll audio capture
 * Maintains the last N milliseconds of audio to avoid clipped first phonemes
 */
export class RingBuffer {
  private buffer: Buffer[] = [];
  private maxDurationMs: number;
  private sampleRate: number;
  private currentDurationMs: number = 0;

  constructor(maxDurationMs: number, sampleRate: number) {
    this.maxDurationMs = maxDurationMs;
    this.sampleRate = sampleRate;
  }

  /**
   * Add a chunk of audio to the ring buffer
   * @param chunk Audio data buffer
   * @param durationMs Duration of this chunk in milliseconds
   */
  add(chunk: Buffer, durationMs: number): void {
    this.buffer.push(chunk);
    this.currentDurationMs += durationMs;

    // Remove old chunks if we exceed max duration
    while (this.currentDurationMs > this.maxDurationMs && this.buffer.length > 1) {
      const removed = this.buffer.shift()!;
      const removedDurationMs = this.calculateDuration(removed);
      this.currentDurationMs -= removedDurationMs;
    }
  }

  /**
   * Get the entire buffer contents
   */
  getBuffer(): Buffer {
    if (this.buffer.length === 0) {
      return Buffer.alloc(0);
    }
    return Buffer.concat(this.buffer);
  }

  /**
   * Get the actual duration of buffered audio
   */
  getDurationMs(): number {
    return this.currentDurationMs;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
    this.currentDurationMs = 0;
  }

  /**
   * Calculate duration of a buffer in milliseconds
   * Assumes 16-bit PCM mono audio
   */
  private calculateDuration(buffer: Buffer): number {
    const bytesPerSample = 2; // 16-bit = 2 bytes
    const samples = buffer.length / bytesPerSample;
    return (samples / this.sampleRate) * 1000;
  }
}
