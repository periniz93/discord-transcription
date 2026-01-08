import { describe, it, expect, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import nock from 'nock';

describe('TranscriptionService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    nock.cleanAll();
    vi.resetModules();

    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('transcribes audio using the OpenAI endpoint', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'whisper-1';

    vi.resetModules();
    const { TranscriptionService } = await import('./TranscriptionService');

    const dir = await fs.mkdtemp(path.join(tmpdir(), 'transcribe-'));
    tempDirs.push(dir);
    const audioPath = path.join(dir, 'audio.wav');
    await fs.writeFile(audioPath, Buffer.from([1, 2, 3]));

    const scope = nock('https://api.openai.com')
      .post('/v1/audio/transcriptions')
      .reply(200, { text: 'hello', segments: [], words: [] });

    const service = new TranscriptionService();
    const result = await service.transcribe(audioPath, 'prompt');

    expect(result.text).toBe('hello');
    scope.done();
  });
});
