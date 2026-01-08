import * as dotenv from 'dotenv';
dotenv.config();

export interface Config {
  discord: {
    token: string;
    clientId: string;
  };
  openai: {
    apiKey: string;
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
  delivery: {
    discordEnabled: boolean;
  };
}

export const config: Config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'whisper-1',
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
  delivery: {
    discordEnabled: process.env.DISCORD_DELIVERY_ENABLED !== 'false', // Default true for backward compatibility
  },
};

const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0;
const isNonNegativeInteger = (value: number) => Number.isInteger(value) && value >= 0;

export const validateConfig = (): string[] => {
  const errors: string[] = [];

  if (!config.discord.token) {
    errors.push('DISCORD_TOKEN is required.');
  }

  if (!config.discord.clientId) {
    errors.push('DISCORD_CLIENT_ID is required.');
  }

  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required.');
  }

  if (!config.openai.model) {
    errors.push('OPENAI_MODEL is required.');
  }

  if (!isPositiveInteger(config.audio.sampleRate)) {
    errors.push('Audio sample rate must be a positive integer.');
  }

  if (!isPositiveInteger(config.audio.channels)) {
    errors.push('Audio channels must be a positive integer.');
  }

  if (!isPositiveInteger(config.audio.silenceDurationMs)) {
    errors.push('SILENCE_DURATION_MS must be a positive integer.');
  }

  if (!isPositiveInteger(config.audio.preRollMs)) {
    errors.push('PREROLL_MS must be a positive integer.');
  }

  if (!isPositiveInteger(config.transcription.concurrency)) {
    errors.push('TRANSCRIPTION_CONCURRENCY must be a positive integer.');
  }

  if (!isNonNegativeInteger(config.transcription.maxRetries)) {
    errors.push('MAX_RETRIES must be a non-negative integer.');
  }

  if (!isNonNegativeInteger(config.transcription.retryDelayMs)) {
    errors.push('RETRY_DELAY_MS must be a non-negative integer.');
  }

  if (config.transcription.timestampGranularities.length === 0) {
    errors.push('At least one timestamp granularity must be configured.');
  }

  const allowedGranularities = new Set(['segment', 'word']);
  for (const granularity of config.transcription.timestampGranularities) {
    if (!allowedGranularities.has(granularity)) {
      errors.push(`Invalid timestamp granularity: ${granularity}`);
      break;
    }
  }

  if (!config.storage.dataDir) {
    errors.push('DATA_DIR must be set to a valid path.');
  }

  if (!isPositiveInteger(config.storage.retentionDays)) {
    errors.push('RETENTION_DAYS must be a positive integer.');
  }

  return errors;
};
