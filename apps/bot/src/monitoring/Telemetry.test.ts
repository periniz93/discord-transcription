import { describe, it, expect, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

describe('Telemetry', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
    vi.resetModules();
  });

  it('writes JSONL entries to metrics.log', async () => {
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'telemetry-'));
    tempDirs.push(dir);
    process.env.DATA_DIR = dir;

    vi.resetModules();
    const { Telemetry } = await import('./Telemetry');

    await Telemetry.record('session_started', { sessionId: 'abc' });

    const logPath = path.join(dir, 'metrics.log');
    const contents = await fs.readFile(logPath, 'utf-8');
    const [line] = contents.trim().split('\n');
    const entry = JSON.parse(line);

    expect(entry.event).toBe('session_started');
    expect(entry.sessionId).toBe('abc');
    expect(entry.timestamp).toBeDefined();
  });
});
