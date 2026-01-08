import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command, CommandContext } from './index';

export const sessionStatusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('session-status')
    .setDescription('Show current session status'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {

    const { sessionManager } = context;
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

    const duration = Date.now() - session.startedAt;
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    const segments = sessionManager.getSegments(session.sessionId);
    const segmentsByUser: Record<string, number> = {};

    for (const segment of segments) {
      segmentsByUser[segment.userId] = (segmentsByUser[segment.userId] || 0) + 1;
    }

    const participantList = Array.from(session.participants.values())
      .map(p => {
        const segmentCount = segmentsByUser[p.userId] || 0;
        return `• ${p.displayName}: ${segmentCount} segments`;
      })
      .join('\n');

    const totalAudioSeconds = segments.reduce((sum, seg) => {
      return sum + (seg.endMs - seg.startMs);
    }, 0) / 1000;

    const totalAudioMinutes = Math.floor(totalAudioSeconds / 60);

    const embed = new EmbedBuilder()
      .setTitle('Recording Session Status')
      .setColor(0xff0000)
      .addFields(
        { name: 'Session ID', value: session.sessionId, inline: false },
        { name: 'State', value: session.state, inline: true },
        { name: 'Duration', value: `${durationMinutes}m ${durationSeconds}s`, inline: true },
        { name: 'Participants', value: `${session.participants.size}`, inline: true },
        { name: 'Total Segments', value: `${segments.length}`, inline: true },
        { name: 'Audio Captured', value: `~${totalAudioMinutes}m`, inline: true },
        { name: 'Glossary Terms', value: `${session.glossary.length}`, inline: true },
        { name: 'Participant Details', value: participantList || 'No participants', inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
