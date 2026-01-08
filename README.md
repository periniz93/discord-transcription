# Discord Multi-Track Transcription Bot

A Discord bot that records voice channels with per-speaker separation and generates transcripts with speaker attribution using Azure OpenAI.

## Features

- Multi-track voice recording (separate audio per speaker)
- Automatic segmentation based on speech pauses
- Azure OpenAI Whisper transcription with custom glossary support
- Speaker-attributed transcripts in Markdown and JSON formats
- Consent management and privacy controls
- Configurable retention policies

## Prerequisites

- Node.js 22.12.0 or higher
- Discord bot with proper permissions
- Azure OpenAI endpoint with transcription model access

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

## Architecture

- `apps/bot` - Discord bot service
- `apps/worker` - Transcription worker (can run separately)
- `packages/shared` - Shared types and configuration

## Important Notes

- Requires consent from all participants
- Voice receiving is not officially supported by Discord (use at your own risk)
- Audio is stored locally and deleted according to retention policy
