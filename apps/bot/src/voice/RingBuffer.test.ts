import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from './RingBuffer';

describe('RingBuffer', () => {
  let ringBuffer: RingBuffer;

  beforeEach(() => {
    ringBuffer = new RingBuffer(500, 16000);
  });

  it('should initialize with empty buffer', () => {
    const buffer = ringBuffer.getBuffer();
    expect(buffer.length).toBe(0);
    expect(ringBuffer.getDurationMs()).toBe(0);
  });

  it('should add chunks to buffer', () => {
    const chunk1 = Buffer.alloc(1600); // 50ms at 16kHz, 16-bit
    ringBuffer.add(chunk1, 50);

    expect(ringBuffer.getDurationMs()).toBe(50);
    expect(ringBuffer.getBuffer().length).toBe(1600);
  });

  it('should maintain maximum duration', () => {
    // Add 600ms of audio (exceeds 500ms limit)
    const chunk1 = Buffer.alloc(3200); // 100ms
    const chunk2 = Buffer.alloc(3200); // 100ms
    const chunk3 = Buffer.alloc(3200); // 100ms
    const chunk4 = Buffer.alloc(3200); // 100ms
    const chunk5 = Buffer.alloc(3200); // 100ms
    const chunk6 = Buffer.alloc(3200); // 100ms

    ringBuffer.add(chunk1, 100);
    ringBuffer.add(chunk2, 100);
    ringBuffer.add(chunk3, 100);
    ringBuffer.add(chunk4, 100);
    ringBuffer.add(chunk5, 100);
    ringBuffer.add(chunk6, 100);

    // Should have removed oldest chunks to stay under 500ms
    expect(ringBuffer.getDurationMs()).toBeLessThanOrEqual(500);
  });

  it('should concatenate multiple chunks', () => {
    const chunk1 = Buffer.from([1, 2, 3, 4]);
    const chunk2 = Buffer.from([5, 6, 7, 8]);

    ringBuffer.add(chunk1, 25);
    ringBuffer.add(chunk2, 25);

    const result = ringBuffer.getBuffer();
    expect(result).toEqual(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it('should clear buffer', () => {
    const chunk = Buffer.alloc(1600);
    ringBuffer.add(chunk, 50);

    ringBuffer.clear();

    expect(ringBuffer.getDurationMs()).toBe(0);
    expect(ringBuffer.getBuffer().length).toBe(0);
  });

  it('should handle empty buffer gracefully', () => {
    const buffer = ringBuffer.getBuffer();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBe(0);
  });
});
