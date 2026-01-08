import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { config, Segment } from '@discord-transcribe/shared';

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
        throw new Error(
          `Transcription failed: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Build a prompt from glossary terms
   * @param glossary Array of terms to include in the prompt
   */
  buildPrompt(glossary: string[]): string {
    if (glossary.length === 0) {
      return 'This is a D&D session. Please preserve capitalization of proper nouns and spell names.';
    }

    const terms = glossary.slice(0, 200).join(', ');
    return `This is a D&D session. Proper nouns and terms: ${terms}. Please preserve capitalization.`;
  }
}
