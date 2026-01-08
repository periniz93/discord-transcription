import { Client, AttachmentBuilder } from 'discord.js';
import { Session } from '@discord-transcribe/shared';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageManager } from './StorageManager';

export class TranscriptDelivery {
  private client: Client;
  private storageManager: StorageManager;

  constructor(client: Client, storageManager: StorageManager) {
    this.client = client;
    this.storageManager = storageManager;
  }

  /**
   * Deliver transcript files to a Discord text channel
   * @param session Session data
   * @param markdownPath Path to markdown transcript
   * @param jsonPath Path to JSON transcript
   * @param srtPath Path to SRT transcript (optional)
   */
  async deliver(
    session: Session,
    markdownPath: string,
    jsonPath: string,
    srtPath?: string
  ): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(session.textChannelId);

      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        console.error(`Cannot deliver to channel ${session.textChannelId}: not a text channel`);
        return;
      }

      // Check file sizes
      const mdStats = await fs.stat(markdownPath);
      const jsonStats = await fs.stat(jsonPath);

      const maxFileSize = 8 * 1024 * 1024; // 8 MB Discord limit
      const totalSize = mdStats.size + jsonStats.size;

      if (totalSize > maxFileSize) {
        // Files too large, provide alternative
        await channel.send({
          content: `Transcript for session \`${session.sessionId}\` is too large to upload directly. Files are available on the server at:\n- ${markdownPath}\n- ${jsonPath}`,
        });
        return;
      }

      // Create attachments
      const attachments: AttachmentBuilder[] = [
        new AttachmentBuilder(markdownPath, { name: 'transcript.md' }),
        new AttachmentBuilder(jsonPath, { name: 'transcript.json' }),
      ];

      if (srtPath) {
        const srtStats = await fs.stat(srtPath);
        if (totalSize + srtStats.size <= maxFileSize) {
          attachments.push(new AttachmentBuilder(srtPath, { name: 'transcript.srt' }));
        }
      }

      // Deliver
      const duration = session.endedAt! - session.startedAt;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);

      await channel.send({
        content: `✅ **Transcript Ready**\n\nSession: \`${session.sessionId}\`\nDuration: ${minutes}m ${seconds}s\nParticipants: ${session.participants.size}`,
        files: attachments,
      });

      console.log(`Transcript delivered for session ${session.sessionId}`);
    } catch (error) {
      console.error(`Failed to deliver transcript for session ${session.sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Save transcript files to storage
   * @param session Session data
   * @param markdownTranscript Markdown transcript content
   * @param jsonTranscript JSON transcript content
   * @param srtTranscript SRT transcript content
   */
  async saveTranscripts(
    session: Session,
    markdownTranscript: string,
    jsonTranscript: string,
    srtTranscript?: string
  ): Promise<{ markdownPath: string; jsonPath: string; srtPath?: string }> {
    const transcriptDir = this.storageManager.getTranscriptDir(session.sessionId);

    const markdownPath = path.join(transcriptDir, 'transcript.md');
    const jsonPath = path.join(transcriptDir, 'transcript.json');
    const srtPath = srtTranscript ? path.join(transcriptDir, 'transcript.srt') : undefined;

    await fs.writeFile(markdownPath, markdownTranscript, 'utf-8');
    await fs.writeFile(jsonPath, jsonTranscript, 'utf-8');

    if (srtTranscript && srtPath) {
      await fs.writeFile(srtPath, srtTranscript, 'utf-8');
    }

    console.log(`Transcripts saved for session ${session.sessionId}`);

    return { markdownPath, jsonPath, srtPath };
  }
}
