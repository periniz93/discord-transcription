import { describe, it, expect, vi, afterEach } from 'vitest';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { AudioProcessor } from './AudioProcessor';

vi.mock('prism-media', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Transform } = require('stream');

  class PassthroughDecoder extends Transform {
    _transform(chunk: Buffer, _encoding: BufferEncoding, callback: () => void) {
      this.push(chunk);
      callback();
    }
  }

  return {
    default: {
      opus: {
        Decoder: PassthroughDecoder,
      },
    },
  };
});

describe('AudioProcessor', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('writes a wav file with header and data', async () => {
    const processor = new AudioProcessor();
    const pcmData = Buffer.from([1, 2, 3, 4]);
    const preRoll = Buffer.from([5, 6]);
    const stream = Readable.from([pcmData]);
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'audio-processor-'));
    tempDirs.push(dir);
    const outputPath = path.join(dir, 'out.wav');

    await processor.processAndSave(stream, outputPath, preRoll);

    const file = await fs.readFile(outputPath);
    expect(file.slice(0, 4).toString('ascii')).toBe('RIFF');
    const dataSize = file.readUInt32LE(40);
    expect(dataSize).toBe(preRoll.length + pcmData.length);
    expect(file.length).toBe(44 + dataSize);
  });

  it('rejects when the opus stream errors', async () => {
    const processor = new AudioProcessor();
    const stream = new Readable({
      read() {
        this.destroy(new Error('boom'));
      },
    });
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'audio-processor-'));
    tempDirs.push(dir);
    const outputPath = path.join(dir, 'out.wav');

    await expect(processor.processAndSave(stream, outputPath)).rejects.toThrow('boom');
  });
});
