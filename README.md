# Discord Multi-Track Transcription Bot

[![Tests](https://img.shields.io/badge/tests-54%20passing-brightgreen)](https://github.com/periniz93/discord-transcription)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A Discord bot that records voice channels with per-speaker separation and generates transcripts with speaker attribution using OpenAI Whisper.

## Features

- Multi-track voice recording (separate audio per speaker)
- Automatic segmentation based on speech pauses
- OpenAI Whisper transcription with custom glossary support
- Speaker-attributed transcripts in Markdown and JSON formats
- Consent management and privacy controls
- Configurable retention policies

## Prerequisites

- Node.js 22.12.0 or higher
- Discord bot with proper permissions
- OpenAI API key with access to Whisper API

## Setup

1. Clone and install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Build the project:
```bash
npm run build
```

4. Run the bot:
```bash
npm run bot
```

## Configuration

See `.env.example` for all configuration options.

### External Service Integration

To use transcripts with an external service instead of posting to Discord:

```env
DISCORD_DELIVERY_ENABLED=false
```

Transcripts will be saved to `./data/transcripts/<session-id>/` without being posted to Discord.

## Docker

Build and run both the bot and worker:

```bash
docker compose up --build
```

This uses the same `.env` file and mounts `./data` into the containers.

## Commands

- `/consent-agree` - Consent to voice recording
- `/consent-revoke` - Revoke consent
- `/consent-status` - Check consent status
- `/session-start` - Start recording the voice channel
- `/session-stop` - Stop recording and generate transcript
- `/session-status` - Show current session status
- `/glossary-add <terms>` - Add terms to glossary (comma-separated)
- `/glossary-show` - Show current glossary
- `/session-delete <session_id>` - Delete session data

### Glossary Examples

See `docs/example-glossary.md` for a ready-to-use starter list.

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

**Test Coverage:** 54 tests across core functionality
- RingBuffer (6 tests)
- SessionManager (15 tests)
- ConsentManager (12 tests)
- TimelineMerger (10 tests)
- TranscriptFormatter (11 tests)

## Architecture

- `apps/bot` - Discord bot service
- `apps/worker` - Transcription worker (can run separately)
- `packages/shared` - Shared types and configuration

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical documentation.

## Important Notes

- Requires consent from all participants
- Voice receiving is not officially supported by Discord (use at your own risk)
- Audio is stored locally and deleted according to retention policy

## Contributing

See [open issues](https://github.com/periniz93/discord-transcription/issues) for planned improvements and enhancements.

## License

MIT
