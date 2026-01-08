import { Utterance, Session } from '@discord-transcribe/shared';

export class TranscriptFormatter {
  /**
   * Format utterances as Markdown transcript
   * @param utterances Timeline of utterances
   * @param session Session metadata
   */
  formatMarkdown(utterances: Utterance[], session: Session): string {
    const lines: string[] = [];

    // Header
    lines.push('# Transcript');
    lines.push('');
    lines.push(`**Session ID:** ${session.sessionId}`);
    lines.push(`**Date:** ${new Date(session.startedAt).toLocaleString()}`);

    if (session.endedAt) {
      const duration = session.endedAt - session.startedAt;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      lines.push(`**Duration:** ${minutes}m ${seconds}s`);
    }

    const participantNames = Array.from(session.participants.values())
      .map(p => p.displayName)
      .join(', ');
    lines.push(`**Participants:** ${participantNames}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Utterances
    for (const utterance of utterances) {
      const timestamp = this.formatTimestamp(utterance.startMs);
      const overlapMarker = utterance.overlap ? ' (overlap)' : '';

      lines.push(`**[${timestamp}] ${utterance.speakerName}${overlapMarker}:**`);
      lines.push(utterance.text);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format utterances as JSON
   * @param utterances Timeline of utterances
   * @param session Session metadata
   */
  formatJSON(utterances: Utterance[], session: Session): string {
    const data = {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      participants: Array.from(session.participants.values()),
      utterances: utterances.map(u => ({
        speakerName: u.speakerName,
        speakerUserId: u.speakerUserId,
        startMs: u.startMs,
        endMs: u.endMs,
        timestamp: this.formatTimestamp(u.startMs),
        text: u.text,
        overlap: u.overlap || false,
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Format utterances as SRT subtitles
   * @param utterances Timeline of utterances
   */
  formatSRT(utterances: Utterance[]): string {
    const lines: string[] = [];

    utterances.forEach((utterance, index) => {
      lines.push(`${index + 1}`);
      lines.push(
        `${this.formatSRTTimestamp(utterance.startMs)} --> ${this.formatSRTTimestamp(utterance.endMs)}`
      );
      lines.push(`${utterance.speakerName}: ${utterance.text}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format milliseconds as HH:MM:SS
   */
  private formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format milliseconds as SRT timestamp (HH:MM:SS,mmm)
   */
  private formatSRTTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }
}
