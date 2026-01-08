# Setup Guide

This guide walks you through setting up the Discord Multi-Track Transcription Bot.

## Prerequisites

1. Node.js 22.12.0 or higher
2. Discord bot application
3. Azure OpenAI endpoint with transcription access

## Step 1: Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section:
   - Click "Add Bot"
   - Enable "SERVER MEMBERS INTENT" (required for voice)
   - Copy the bot token (you'll need this for `.env`)
4. Go to "OAuth2" > "General":
   - Copy the "CLIENT ID" (you'll need this for `.env`)
5. Go to "OAuth2" > "URL Generator":
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions:
     - Send Messages
     - Read Message History
     - Connect (voice)
     - Speak (voice)
   - Copy the generated URL and use it to invite the bot to your server

## Step 2: Azure OpenAI Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Create or access your Azure OpenAI resource
3. Note your endpoint URL (e.g., `https://your-resource.openai.azure.com`)
4. Go to "Keys and Endpoint" to get your API key
5. Ensure you have access to `gpt-4o-transcribe` model deployment

## Step 3: Installation

1. Clone the repository:
```bash
cd discord-transcribe-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` with your credentials:
```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

AZURE_ENDPOINT=https://your-resource.openai.azure.com
AZURE_API_KEY=your_azure_api_key_here
AZURE_API_VERSION=2024-06-01
AZURE_MODEL=gpt-4o-transcribe
```

## Step 4: Build

```bash
npm run build
```

## Step 5: Run

Start the bot:
```bash
npm run bot
```

You should see:
```
Started refreshing application (/) commands.
Successfully reloaded application (/) commands.
Ready! Logged in as YourBot#1234
```

## Step 6: Test

1. In your Discord server, use `/consent-agree` to consent to recording
2. Join a voice channel
3. Use `/session-start` to begin recording
4. Speak for a bit
5. Use `/session-stop` to end recording
6. Wait for the transcript to be posted

## Commands

- `/consent-agree` - Consent to voice recording
- `/consent-revoke` - Revoke consent
- `/consent-status` - Check consent status
- `/session-start` - Start recording
- `/session-stop` - Stop recording and generate transcript
- `/session-status` - View current session info
- `/glossary-add <terms>` - Add D&D terms (comma-separated)
- `/glossary-show` - View glossary
- `/session-delete <session_id>` - Delete session data

## Troubleshooting

### Bot doesn't join voice channel
- Check that the bot has Connect and Speak permissions
- Ensure SERVER MEMBERS INTENT is enabled in Discord Developer Portal
- Verify you're in a voice channel when running `/session start`

### Transcription fails
- Verify Azure credentials in `.env`
- Check Azure OpenAI endpoint is correct
- Ensure you have quota/access to transcription API
- Check bot logs for specific error messages

### "Missing required configuration"
- Double-check all fields in `.env` are filled
- Ensure no trailing spaces in values
- Restart the bot after changing `.env`

### Audio quality issues
- Adjust `SILENCE_DURATION_MS` in `.env` (default: 1000)
- Adjust `PREROLL_MS` for clipped speech (default: 500)

## Advanced Configuration

### Transcription Settings

```env
# Increase for faster transcription (uses more API quota)
TRANSCRIPTION_CONCURRENCY=10

# Increase for more retry attempts on failures
MAX_RETRIES=5

# Adjust retry delay
RETRY_DELAY_MS=2000
```

### Storage Settings

```env
# Change data directory
DATA_DIR=/var/lib/discord-transcribe

# Adjust retention (days)
RETENTION_DAYS=30
```

### Audio Settings

```env
# Silence detection (milliseconds)
SILENCE_DURATION_MS=1200

# Pre-roll buffer to avoid clipped speech
PREROLL_MS=600
```

## Production Deployment

For production, consider:

1. Run as a systemd service (see `docs/systemd-service.md`)
2. Use a process manager like PM2
3. Set up log rotation
4. Configure firewall rules
5. Use a dedicated data directory
6. Set up monitoring/alerts
7. Regular backups of consent data

## Support

For issues or questions:
- Check the logs in the console
- Review Discord bot permissions
- Verify Azure OpenAI access
- See GitHub issues for known problems
