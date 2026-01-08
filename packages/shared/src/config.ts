import * as dotenv from 'dotenv';
dotenv.config();

export interface Config {
  discord: {
    token: string;
    clientId: string;
  };
  azure: {
    endpoint: string;
    apiKey: string;
    apiVersion: string;
    model: string;
  };
  audio: {
    format: 'wav' | 'flac';
    sampleRate: number;
    channels: number;
    silenceDurationMs: number; // AfterSilence duration
    preRollMs: number; // Ring buffer size
  };
  transcription: {
    concurrency: number;
    maxRetries: number;
    retryDelayMs: number;
    timestampGranularities: ('segment' | 'word')[];
  };
  storage: {
    dataDir: string;
    retentionDays: number;
  };
}

export const config: Config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },
  azure: {
    endpoint: process.env.AZURE_ENDPOINT || '',
    apiKey: process.env.AZURE_API_KEY || '',
    apiVersion: process.env.AZURE_API_VERSION || '2024-06-01',
    model: process.env.AZURE_MODEL || 'gpt-4o-transcribe',
  },
  audio: {
    format: 'wav',
    sampleRate: 16000,
    channels: 1,
    silenceDurationMs: parseInt(process.env.SILENCE_DURATION_MS || '1000'),
    preRollMs: parseInt(process.env.PREROLL_MS || '500'),
  },
  transcription: {
    concurrency: parseInt(process.env.TRANSCRIPTION_CONCURRENCY || '6'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
    timestampGranularities: ['segment'],
  },
  storage: {
    dataDir: process.env.DATA_DIR || './data',
    retentionDays: parseInt(process.env.RETENTION_DAYS || '7'),
  },
};
