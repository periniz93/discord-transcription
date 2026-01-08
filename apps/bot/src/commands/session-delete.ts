import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command, CommandContext } from './index';

export const sessionDeleteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('session-delete')
    .setDescription('Delete a session and all its data')
    .addStringOption(option =>
      option
        .setName('session_id')
        .setDescription('The session ID to delete')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {

    const { sessionManager, storageManager } = context;
    const sessionId = interaction.options.getString('session_id', true);
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    const session = sessionManager.getSession(sessionId);

    if (!session) {
      await interaction.reply({
        content: 'Session not found.',
        ephemeral: true,
      });
      return;
    }

    // Check if session belongs to this guild
    if (session.guildId !== guildId) {
      await interaction.reply({
        content: 'You can only delete sessions from this server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Delete from storage
      await storageManager.deleteSession(sessionId);

      // Delete from session manager
      sessionManager.deleteSession(sessionId);

      await interaction.editReply({
        content: `Session \`${sessionId}\` has been deleted. All audio and transcript data has been removed.`,
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      await interaction.editReply({
        content: 'Failed to delete session.',
      });
    }
  },
};
