import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { buildGlossaryPrompt, config } from '@discord-transcribe/shared';

export interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
  words?: TranscriptionWord[];
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export class TranscriptionError extends Error {
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

export class TranscriptionService {
  private apiKey: string;
  private model: string;
  private endpoint: string = 'https://api.openai.com/v1/audio/transcriptions';

  constructor() {
    this.apiKey = config.openai.apiKey;
    this.model = config.openai.model;
  }

  /**
   * Transcribe an audio file using OpenAI Whisper API
   * @param audioPath Path to the audio file
   * @param prompt Optional prompt with glossary terms
   * @param timestampGranularities Timestamp granularities to request
   */
  async transcribe(
    audioPath: string,
    prompt?: string,
    timestampGranularities: ('segment' | 'word')[] = ['segment']
  ): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('file', createReadStream(audioPath));
    formData.append('model', this.model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', timestampGranularities.join(','));

    if (prompt) {
      formData.append('prompt', prompt);
    }

    try {
      const response = await axios.post(this.endpoint, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 120000, // 2 minutes
      });

      return {
        text: response.data.text || '',
        segments: response.data.segments,
        words: response.data.words,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const retryAfterMs = this.parseRetryAfterMs(axiosError.response?.headers);
        const message = `Transcription failed: ${status} - ${JSON.stringify(axiosError.response?.data)}`;

        throw new TranscriptionError(message, status, retryAfterMs, status === 429);
      }
      throw error;
    }
  }

  /**
   * Build a prompt from glossary terms
   * @param glossary Array of terms to include in the prompt
   */
  buildPrompt(glossary: string[]): string {
    return buildGlossaryPrompt(glossary);
  }

  private parseRetryAfterMs(headers?: Record<string, string>): number | undefined {
    if (!headers) {
      return undefined;
    }

    const retryAfter = headers['retry-after'];
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds)) {
        return Math.max(0, Math.round(seconds * 1000));
      }

      const dateMs = Date.parse(retryAfter);
      if (!Number.isNaN(dateMs)) {
        return Math.max(0, dateMs - Date.now());
      }
    }

    const resetRequests = headers['x-ratelimit-reset-requests'];
    if (resetRequests) {
      const match = resetRequests.match(/^(\d+(\.\d+)?)(ms|s)?$/);
      if (match) {
        const value = Number(match[1]);
        const unit = match[3] || 's';
        return Math.max(0, Math.round(unit === 'ms' ? value : value * 1000));
      }
    }

    return undefined;
  }
}
