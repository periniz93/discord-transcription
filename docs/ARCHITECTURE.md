# Architecture Overview

## System Design

The Discord Multi-Track Transcription Bot is designed with separation of concerns:

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Discord Bot                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Commands   │  │    Voice     │  │   Sessions   │     │
│  │   Handler    │  │   Recorder   │  │   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                    ┌───────▼──────┐
                    │   Storage    │
                    │   Manager    │
                    └───────┬──────┘
                            │
                    ┌───────▼──────────────────────┐
                    │   Transcription Worker       │
                    │  ┌────────────────────────┐  │
                    │  │  Transcription Queue   │  │
                    │  └────────────────────────┘  │
                    │  ┌────────────────────────┐  │
                    │  │   Timeline Merger      │  │
                    │  └────────────────────────┘  │
                    │  ┌────────────────────────┐  │
                    │  │  Transcript Formatter  │  │
                    │  └────────────────────────┘  │
                    └──────────────────────────────┘
                            │
                    ┌───────▼──────┐
                    │  Azure OpenAI│
                    │ Transcription│
                    └──────────────┘
```

## Data Flow

### Recording Flow

1. User issues `/session start` command
2. Bot validates consent for all voice channel members
3. Bot joins voice channel
4. `VoiceRecorder` subscribes to each participant's audio stream
5. For each participant:
   - Continuous stream feeds `RingBuffer` (pre-roll audio)
   - When speaking detected, creates segment with pre-roll
   - Uses `AfterSilence` to auto-close segment after silence
   - `AudioProcessor` converts Opus → PCM → WAV
6. Segments saved with timestamps to disk

### Transcription Flow

1. User issues `/session stop` command
2. Bot disconnects from voice, finalizes segments
3. `SessionProcessor` kicks off background transcription
4. `TranscriptionQueue` processes segments with configurable concurrency
5. For each segment:
   - Builds prompt from glossary
   - Calls Azure OpenAI `/v1/audio/transcriptions`
   - Retries on failure with exponential backoff
6. Results stored back to segment records

### Merge & Delivery Flow

1. `TimelineMerger` sorts segments by timestamp
2. Detects overlapping speech
3. Groups consecutive utterances from same speaker
4. `TranscriptFormatter` generates outputs:
   - Markdown (human-readable)
   - JSON (structured, programmatic)
   - SRT (subtitles)
5. `TranscriptDelivery` uploads files to Discord
6. Falls back to file paths if too large

## Key Design Decisions

### Per-User Streams

We use Discord's `VoiceReceiver.subscribe(userId)` to get separate audio streams per user. This is superior to mixed audio + diarization because:
- No speaker confusion
- Better attribution accuracy
- Simpler post-processing
- Cheaper (less audio to transcribe)

Trade-off: Relies on unofficial Discord API behavior.

### Segment-Based Recording

Instead of continuous files, we record "utterance segments" (bursts of speech):
- Triggers on speaking events
- Auto-closes after silence (`AfterSilence` behavior)
- Includes pre-roll buffer to avoid clipped speech

Benefits:
- Only transcribe speech (not 3 hours of silence)
- Natural chunking for API calls
- Easier retry/recovery

### Ring Buffer for Pre-Roll

A continuous background stream feeds a ring buffer (last 500ms). When a segment starts, we prepend the buffer. This solves the "first phoneme clipped" problem where VAD detection fires after speech begins.

### Glossary Prompt

Azure OpenAI transcription accepts a free-text `prompt` parameter. We use this to inject D&D-specific terms:

```
"This is a D&D session. Proper nouns: Waterdeep, Strahd, Vecna. Spells: Eldritch Blast. Please preserve capitalization."
```

This significantly improves accuracy for fantasy terms.

### Concurrency with Retry

The transcription queue processes multiple segments in parallel (default: 6) with exponential backoff retry on failure. This balances speed and reliability.

## Storage Layout

```
data/
├── consents.json              # Consent records
├── sessions/                  # Session metadata
│   └── {session-id}/
│       └── session.json
├── segments/                  # Raw audio segments
│   └── {session-id}/
│       ├── {segment-id}_user123_Alice.wav
│       ├── {segment-id}_user456_Bob.wav
│       └── ...
└── transcripts/               # Final outputs
    └── {session-id}/
        ├── transcript.md
        ├── transcript.json
        └── transcript.srt
```

## Failure Modes & Mitigations

### Discord API Changes

**Risk**: Voice receive isn't officially supported; Discord could break it.

**Mitigation**:
- Clear documentation of dependency
- Diarization fallback (capture mixed audio, use diarization mode)

### Transcription API Failures

**Risk**: Azure API rate limits, outages, or quota exhaustion.

**Mitigation**:
- Retry with exponential backoff
- Concurrency limiting
- Job queue for recovery
- Segments stored even if transcription fails (can retry later)

### Large Sessions

**Risk**: 8-hour session with 6 speakers = hundreds of segments, large API cost.

**Mitigation**:
- Configurable retention policy (auto-delete old data)
- Per-segment storage (failed segments don't block others)
- Delivery checks file size before upload

### Consent Violations

**Risk**: User joins mid-session without consent.

**Mitigation**:
- Consent check on session start
- Consent database persisted to disk
- Only record consented participants
- Clear warning message when recording starts

## Scalability

### Current Design (MVP)

- Single bot process
- In-memory session state
- Local disk storage
- In-process transcription

**Capacity**: ~1-2 concurrent sessions per instance

### Growth Path

For production scale:

1. **Separate worker process**
   - Bot publishes to job queue (Redis, BullMQ)
   - Worker pool consumes jobs
   - Scales independently

2. **Persistent state**
   - PostgreSQL for sessions/segments
   - Redis for active state
   - Crash recovery via persisted state

3. **Blob storage**
   - S3/Azure Blob for audio/transcripts
   - Signed URLs for sharing
   - CDN for delivery

4. **Multi-bot sharding**
   - Discord.js sharding for large bot
   - Horizontal scaling

## Security Considerations

### Consent Management

- Explicit opt-in required
- Per-guild consent records
- Revocation supported
- Persistent consent database

### Data Protection

- Audio stored locally (not cloud by default)
- Configurable retention (default: 7 days)
- Deletion command for immediate removal
- No audio sent to Azure (only for transcription)

### API Keys

- Environment variable configuration
- Never logged or exposed
- Validated on startup

## Testing Strategy

### Unit Tests

- AudioProcessor (Opus decode, WAV generation)
- TimelineMerger (overlap detection, sorting)
- TranscriptFormatter (output formats)
- RingBuffer (pre-roll logic)

### Integration Tests

- Mock Discord voice streams
- Mock Azure API responses
- End-to-end segment → transcript flow

### Manual Tests

- Real Discord voice channel
- Multiple speakers
- Overlapping speech
- Fantasy term transcription
- Large sessions
- API failure scenarios

## Monitoring

Key metrics to track:

- Active sessions
- Segments recorded
- Transcription queue depth
- API latency/errors
- Storage usage
- Retention cleanup runs

Recommended tools:
- Prometheus + Grafana
- Discord bot dashboard
- Azure Monitor for API calls
