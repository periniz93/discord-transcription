import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command, CommandContext } from './index';

const consentAgreeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('consent-agree')
    .setDescription('Consent to voice recording in this server'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { consentManager } = context;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    await consentManager.grantConsent(guildId, userId);
    await interaction.reply({
      content: 'You have consented to voice recording in this server. You can revoke this at any time with `/consent-revoke`.',
      ephemeral: true,
    });
  },
};

const consentRevokeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('consent-revoke')
    .setDescription('Revoke consent for voice recording in this server'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { consentManager } = context;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    await consentManager.revokeConsent(guildId, userId);
    await interaction.reply({
      content: 'Your consent has been revoked. You will not be recorded in future sessions.',
      ephemeral: true,
    });
  },
};

const consentStatusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('consent-status')
    .setDescription('Check your consent status in this server'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { consentManager } = context;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    const hasConsent = consentManager.hasConsent(guildId, userId);
    const consent = consentManager.getConsent(guildId, userId);

    if (hasConsent && consent) {
      const date = new Date(consent.consentedAt).toLocaleString();
      await interaction.reply({
        content: `You have consented to voice recording in this server since ${date}.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'You have not consented to voice recording in this server. Use `/consent-agree` to consent.',
        ephemeral: true,
      });
    }
  },
};

export const consentCommand = consentAgreeCommand;
export { consentRevokeCommand, consentStatusCommand };
