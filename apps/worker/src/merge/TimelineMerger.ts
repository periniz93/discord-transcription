import { Segment, Utterance, Session } from '@discord-transcribe/shared';

export class TimelineMerger {
  /**
   * Merge transcribed segments into a chronological timeline
   * @param segments Array of segments with transcripts
   * @param session Session data with participant info
   */
  merge(segments: Segment[], session: Session): Utterance[] {
    // Filter out segments without transcripts
    const validSegments = segments.filter(s => s.transcript && s.transcript.trim().length > 0);

    // Convert segments to utterances
    const utterances: Utterance[] = validSegments.map(segment => {
      const participant = session.participants.get(segment.userId);
      const speakerName = participant?.displayName || `User ${segment.userId}`;

      return {
        speakerName,
        speakerUserId: segment.userId,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.transcript!,
      };
    });

    // Sort by start time
    utterances.sort((a, b) => a.startMs - b.startMs);

    // Mark overlaps
    for (let i = 0; i < utterances.length - 1; i++) {
      const current = utterances[i];
      const next = utterances[i + 1];

      // Check if next utterance starts before current ends
      if (next.startMs < current.endMs) {
        const overlapMs = current.endMs - next.startMs;

        // If overlap is significant (> 500ms), mark both as overlapping
        if (overlapMs > 500) {
          current.overlap = true;
          next.overlap = true;
        }
      }
    }

    return utterances;
  }

  /**
   * Group consecutive utterances from the same speaker
   * @param utterances Timeline of utterances
   */
  groupBySpeaker(utterances: Utterance[]): Utterance[] {
    if (utterances.length === 0) {
      return [];
    }

    const grouped: Utterance[] = [];
    let current = { ...utterances[0] };

    for (let i = 1; i < utterances.length; i++) {
      const next = utterances[i];

      // Group if same speaker and no overlap and gap is small (< 2 seconds)
      const gap = next.startMs - current.endMs;
      if (
        next.speakerUserId === current.speakerUserId &&
        !next.overlap &&
        !current.overlap &&
        gap < 2000
      ) {
        // Merge texts
        current.text += ' ' + next.text;
        current.endMs = next.endMs;
      } else {
        // Push current and start new group
        grouped.push(current);
        current = { ...next };
      }
    }

    // Push final group
    grouped.push(current);

    return grouped;
  }
}
