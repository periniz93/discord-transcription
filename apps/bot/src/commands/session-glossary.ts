import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command, CommandContext } from './index';

const glossaryAddCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('glossary-add')
    .setDescription('Add terms to the session glossary')
    .addStringOption(option =>
      option
        .setName('terms')
        .setDescription('Comma-separated list of terms (e.g. "Waterdeep, Eldritch Blast, Strahd")')
        .setRequired(true)
    ),

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

    const termsInput = interaction.options.getString('terms', true);
    const terms = termsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

    for (const term of terms) {
      sessionManager.addGlossaryTerm(session.sessionId, term);
    }

    await interaction.reply({
      content: `Added ${terms.length} term(s) to the glossary: ${terms.join(', ')}`,
      ephemeral: true,
    });
  },
};

const glossaryShowCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('glossary-show')
    .setDescription('Show current session glossary'),

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

    const glossary = sessionManager.getGlossary(session.sessionId);

    if (glossary.length === 0) {
      await interaction.reply({
        content: 'The glossary is empty. Use `/glossary-add` to add terms.',
        ephemeral: true,
      });
    } else {
      const maxDisplay = 50;
      const displayTerms = glossary.slice(0, maxDisplay);
      const remaining = glossary.length - maxDisplay;

      let content = `**Glossary (${glossary.length} terms):**\n${displayTerms.join(', ')}`;

      if (remaining > 0) {
        content += `\n\n...and ${remaining} more`;
      }

      await interaction.reply({ content, ephemeral: true });
    }
  },
};

export const sessionGlossaryCommand = glossaryAddCommand;
export const sessionGlossaryShowCommand = glossaryShowCommand;
