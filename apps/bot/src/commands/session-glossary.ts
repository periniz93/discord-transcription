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
    const rawTerms = termsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const addedTerms: string[] = [];
    const duplicateTerms: string[] = [];
    const invalidTerms: string[] = [];

    const clipTerm = (term: string, maxLength: number) => {
      if (term.length <= maxLength) {
        return term;
      }
      return `${term.slice(0, maxLength - 3)}...`;
    };

    for (const term of rawTerms) {
      const result = sessionManager.addGlossaryTerm(session.sessionId, term);
      if (result.status === 'added' && result.term) {
        addedTerms.push(result.term);
      } else if (result.status === 'duplicate' && result.term) {
        duplicateTerms.push(result.term);
      } else {
        invalidTerms.push(clipTerm(term, 80));
      }
    }

    if (rawTerms.length === 0) {
      await interaction.reply({
        content: 'No valid terms found. Provide a comma-separated list of terms.',
        ephemeral: true,
      });
      return;
    }

    const formatList = (terms: string[]) => {
      const maxDisplay = 10;
      const displayTerms = terms.slice(0, maxDisplay);
      const remaining = terms.length - displayTerms.length;
      let content = displayTerms.join(', ');

      if (remaining > 0) {
        content += `, ...and ${remaining} more`;
      }

      return content;
    };

    const responseParts: string[] = [];

    if (addedTerms.length > 0) {
      responseParts.push(`Added ${addedTerms.length} term(s): ${formatList(addedTerms)}`);
    }

    if (duplicateTerms.length > 0) {
      responseParts.push(`Ignored ${duplicateTerms.length} duplicate(s): ${formatList(duplicateTerms)}`);
    }

    if (invalidTerms.length > 0) {
      responseParts.push(
        `Rejected ${invalidTerms.length} invalid term(s) (empty or too long): ${formatList(invalidTerms)}`
      );
    }

    await interaction.reply({
      content: responseParts.join('\n'),
      ephemeral: true,
      allowedMentions: { parse: [] },
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
