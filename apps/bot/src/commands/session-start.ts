import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  DiscordGatewayAdapterCreator,
} from '@discordjs/voice';
import { SessionState } from '@discord-transcribe/shared';
import { Command, CommandContext } from './index';
import { VoiceRecorder } from '../voice/VoiceRecorder';
import { Telemetry } from '../monitoring/Telemetry';

export const sessionStartCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('session-start')
    .setDescription('Start recording the voice channel'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {

    const { sessionManager, consentManager, storageManager } = context;
    const guildId = interaction.guildId;
    const member = interaction.member as GuildMember;

    if (!guildId || !member) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    // Check if user is in a voice channel
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: 'You must be in a voice channel to start a recording session.',
        ephemeral: true,
      });
      return;
    }

    // Check if there's already an active session
    const existingSession = sessionManager.getSessionByGuild(guildId);
    if (existingSession) {
      await interaction.reply({
        content: 'There is already an active recording session in this server.',
        ephemeral: true,
      });
      return;
    }

    // Check bot permissions
    const permissions = voiceChannel.permissionsFor(interaction.client.user!);
    if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
      await interaction.reply({
        content: 'I need Connect and Speak permissions in that voice channel.',
        ephemeral: true,
      });
      return;
    }

    // Get current voice channel members
    const voiceMembers = Array.from(voiceChannel.members.values()).filter(m => !m.user.bot);

    // Check consent for all participants
    const unconsentedMembers = voiceMembers.filter(
      m => !consentManager.hasConsent(guildId, m.id)
    );

    if (unconsentedMembers.length > 0) {
      const memberList = unconsentedMembers.map(m => m.displayName).join(', ');
      await interaction.reply({
        content: `The following members have not consented to recording: ${memberList}\n\nThey must use \`/consent agree\` before recording can start.`,
        ephemeral: true,
      });
      return;
    }

    // Defer reply since joining and setting up might take a moment
    await interaction.deferReply();

    try {
      // Create session
      const session = sessionManager.createSession(
        guildId,
        voiceChannel.id,
        interaction.channelId!
      );

      // Add participants
      for (const member of voiceMembers) {
        sessionManager.addParticipant(session.sessionId, member.id, member.displayName, true);
      }

      // Create storage directories
      await storageManager.createSessionDirectories(session.sessionId);

      // Join voice channel
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      });

      // Wait for connection to be ready
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      // Store connection
      sessionManager.setVoiceConnection(session.sessionId, connection);

      // Start recording
      const recorder = new VoiceRecorder(session, sessionManager, storageManager);
      await recorder.start(connection);

      // Update session state
      sessionManager.updateSessionState(session.sessionId, SessionState.RECORDING);
      void Telemetry.record('session_started', {
        sessionId: session.sessionId,
        guildId,
        voiceChannelId: voiceChannel.id,
        participantCount: voiceMembers.length,
      });

      // Announce in text channel
      const textChannel = await interaction.client.channels.fetch(interaction.channelId!);
      if (textChannel?.isTextBased() && 'send' in textChannel) {
        await textChannel.send({
          content: `🔴 **Recording started in ${voiceChannel.name}**\n\nBy remaining in the voice channel, you consent to being recorded. Participants: ${voiceMembers.map(m => m.displayName).join(', ')}`,
        });
      }

      await interaction.editReply({
        content: `Recording started! Session ID: \`${session.sessionId}\``,
      });
    } catch (error) {
      console.error('Error starting session:', error);
      void Telemetry.record('session_start_failed', {
        guildId,
        voiceChannelId: voiceChannel?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await interaction.editReply({
        content: 'Failed to start recording session. Please try again.',
      });
    }
  },
};
