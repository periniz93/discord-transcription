import { Transform, Readable, Writable } from 'stream';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import prism from 'prism-media';
import { config } from '@discord-transcribe/shared';

const pipelineAsync = promisify(pipeline);

/**
 * Processes audio streams from Discord (Opus) to WAV format
 */
export class AudioProcessor {
  /**
   * Process an Opus audio stream and save as WAV with optional pre-roll
   * @param opusStream The Opus audio stream from Discord
   * @param outputPath Path to save the WAV file
   * @param preRollBuffer Optional buffer to prepend (already in PCM format)
   */
  async processAndSave(
    opusStream: Readable,
    outputPath: string,
    preRollBuffer?: Buffer
  ): Promise<void> {
    // Create Opus decoder
    const decoder = new prism.opus.Decoder({
      rate: config.audio.sampleRate,
      channels: config.audio.channels,
      frameSize: 960,
    });

    // Collect all PCM chunks
    const chunks: Buffer[] = [];

    // Add pre-roll if available
    if (preRollBuffer && preRollBuffer.length > 0) {
      chunks.push(preRollBuffer);
    }

    // Decode Opus to PCM
    await new Promise<void>((resolve, reject) => {
      opusStream
        .pipe(decoder)
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Concatenate all PCM data
    const pcmData = Buffer.concat(chunks);

    // Write as WAV file
    await this.writeWavFile(outputPath, pcmData);
  }

  /**
   * Write PCM data as a WAV file
   * @param outputPath Path to save the WAV file
   * @param pcmData Raw PCM audio data (16-bit, mono)
   */
  private async writeWavFile(outputPath: string, pcmData: Buffer): Promise<void> {
    const sampleRate = config.audio.sampleRate;
    const channels = config.audio.channels;
    const bitsPerSample = 16;

    // WAV header
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);

    // RIFF chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // ByteRate
    header.writeUInt16LE(channels * (bitsPerSample / 8), 32); // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    // Write header and data to file
    const writeStream = createWriteStream(outputPath);
    await new Promise<void>((resolve, reject) => {
      writeStream.write(header, (err) => {
        if (err) return reject(err);
        writeStream.write(pcmData, (err) => {
          if (err) return reject(err);
          writeStream.end(resolve);
        });
      });
    });
  }
}
