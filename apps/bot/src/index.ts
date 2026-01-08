import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import { config, validateConfig, SessionState } from '@discord-transcribe/shared';
import { commands } from './commands';
import { SessionManager } from './sessions/SessionManager';
import { ConsentManager } from './sessions/ConsentManager';
import { StorageManager } from './storage/StorageManager';
import { SessionPersistence } from './sessions/SessionPersistence';
import { SessionProcessor } from './sessions/SessionProcessor';

// Initialize managers
const sessionManager = new SessionManager();
const consentManager = new ConsentManager();
const storageManager = new StorageManager();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// Register slash commands
async function registerCommands() {
  const rest = new REST().setToken(config.discord.token);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands.map(cmd => cmd.data.toJSON()) },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Handle interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find(cmd => cmd.data.name === interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction, {
      sessionManager,
      consentManager,
      storageManager,
      client,
    });
  } catch (error) {
    console.error('Error executing command:', error);

    const errorMessage = { content: 'There was an error executing this command!', ephemeral: true };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Bot ready event
client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Start the bot
async function start() {
  // Validate config
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    console.error('Configuration validation failed:');
    for (const error of configErrors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  // Initialize storage
  await storageManager.initialize();

  // Initialize consent manager
  await consentManager.initialize();

  // Initialize session persistence and load any recovered sessions
  const sessionPersistence = new SessionPersistence(storageManager);
  await sessionManager.loadFromPersistence(sessionPersistence);

  // Register commands
  await registerCommands();

  // Start cleanup scheduler (every 24 hours)
  setInterval(async () => {
    console.log('Running scheduled cleanup...');
    await storageManager.cleanupOldSessions();
  }, 24 * 60 * 60 * 1000);

  // Login to Discord
  await client.login(config.discord.token);

  const recoverableSessions = sessionManager
    .getAllSessions()
    .filter(
      session =>
        session.state === SessionState.STOPPING || session.state === SessionState.TRANSCRIBING,
    );

  if (recoverableSessions.length > 0) {
    console.log(`Recovering ${recoverableSessions.length} session(s) after restart...`);
    const processor = new SessionProcessor(sessionManager, storageManager, client);

    for (const session of recoverableSessions) {
      processor.processSession(session.sessionId).catch(error => {
        console.error(`Error recovering session ${session.sessionId}:`, error);
      });
    }
  }
}

start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');

  // Stop all active sessions
  for (const session of sessionManager.getAllSessions()) {
    await sessionManager.stopSession(session.sessionId);
  }

  client.destroy();
  process.exit(0);
});
