import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SessionState } from '@discord-transcribe/shared';
import { Command, CommandContext } from './index';
import { SessionProcessor } from '../sessions/SessionProcessor';

export const sessionStopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('session-stop')
    .setDescription('Stop the current recording session'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {

    const { sessionManager, storageManager, client } = context;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    const session = sessionManager.getSessionByGuild(guildId);
    if (!session) {
      await interaction.reply({
        content: 'There is no active recording session in this server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Stop the session
      await sessionManager.stopSession(session.sessionId);

      const duration = session.endedAt! - session.startedAt;
      const durationMinutes = Math.floor(duration / 60000);
      const durationSeconds = Math.floor((duration % 60000) / 1000);

      const segments = sessionManager.getSegments(session.sessionId);
      const participantCount = session.participants.size;

      await interaction.editReply({
        content: `Recording stopped!\n\nSession ID: \`${session.sessionId}\`\nDuration: ${durationMinutes}m ${durationSeconds}s\nParticipants: ${participantCount}\nSegments captured: ${segments.length}\n\nTranscription starting...`,
      });

      // Process session asynchronously
      const processor = new SessionProcessor(sessionManager, storageManager, client);
      processor.processSession(session.sessionId).catch(error => {
        console.error('Error in background processing:', error);
      });
    } catch (error) {
      console.error('Error stopping session:', error);
      await interaction.editReply({
        content: 'Failed to stop recording session.',
      });
    }
  },
};
