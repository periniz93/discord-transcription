# Running as a Systemd Service

For production deployments, run the bot as a systemd service for automatic restarts and logging.

## Service File

Create `/etc/systemd/system/discord-transcribe-bot.service`:

```ini
[Unit]
Description=Discord Multi-Track Transcription Bot
After=network.target

[Service]
Type=simple
User=discord-bot
WorkingDirectory=/opt/discord-transcribe-bot
ExecStart=/usr/bin/node /opt/discord-transcribe-bot/apps/bot/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-transcribe-bot

# Environment
Environment="NODE_ENV=production"
EnvironmentFile=/opt/discord-transcribe-bot/.env

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/discord-transcribe-bot/data

[Install]
WantedBy=multi-user.target
```

## Setup Steps

1. Create dedicated user:
```bash
sudo useradd -r -s /bin/false discord-bot
```

2. Install the bot:
```bash
sudo mkdir -p /opt/discord-transcribe-bot
sudo cp -r discord-transcribe-bot/* /opt/discord-transcribe-bot/
cd /opt/discord-transcribe-bot
npm install --production
npm run build
```

3. Create data directory:
```bash
sudo mkdir -p /opt/discord-transcribe-bot/data
sudo chown -R discord-bot:discord-bot /opt/discord-transcribe-bot
```

4. Configure environment:
```bash
sudo cp .env.example .env
sudo nano .env  # Edit with your credentials
sudo chown discord-bot:discord-bot .env
sudo chmod 600 .env
```

5. Install and enable service:
```bash
sudo cp docs/discord-transcribe-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable discord-transcribe-bot
sudo systemctl start discord-transcribe-bot
```

## Management

Check status:
```bash
sudo systemctl status discord-transcribe-bot
```

View logs:
```bash
sudo journalctl -u discord-transcribe-bot -f
```

Restart:
```bash
sudo systemctl restart discord-transcribe-bot
```

Stop:
```bash
sudo systemctl stop discord-transcribe-bot
```

## Log Rotation

Create `/etc/logrotate.d/discord-transcribe-bot`:

```
/var/log/discord-transcribe-bot/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 discord-bot discord-bot
    sharedscripts
    postrotate
        systemctl reload discord-transcribe-bot
    endscript
}
```

## Monitoring with systemd

Enable email notifications on failure:

```bash
sudo systemctl edit discord-transcribe-bot
```

Add:
```ini
[Unit]
OnFailure=status-email@%n.service
```

## Updating

To update the bot:

```bash
cd /opt/discord-transcribe-bot
sudo -u discord-bot git pull
sudo -u discord-bot npm install
sudo -u discord-bot npm run build
sudo systemctl restart discord-transcribe-bot
```

## Troubleshooting

If the service fails to start:

1. Check logs:
```bash
sudo journalctl -u discord-transcribe-bot -n 50
```

2. Verify permissions:
```bash
sudo ls -la /opt/discord-transcribe-bot
sudo ls -la /opt/discord-transcribe-bot/data
```

3. Test manually:
```bash
sudo -u discord-bot /usr/bin/node /opt/discord-transcribe-bot/apps/bot/dist/index.js
```

4. Check environment file:
```bash
sudo -u discord-bot cat /opt/discord-transcribe-bot/.env
```
