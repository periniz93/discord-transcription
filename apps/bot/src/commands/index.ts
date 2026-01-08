import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SessionManager } from '../sessions/SessionManager';
import { ConsentManager } from '../sessions/ConsentManager';
import { StorageManager } from '../storage/StorageManager';

import { sessionStartCommand } from './session-start';
import { sessionStopCommand } from './session-stop';
import { sessionStatusCommand } from './session-status';
import { sessionGlossaryCommand, sessionGlossaryShowCommand } from './session-glossary';
import { sessionDeleteCommand } from './session-delete';
import { consentCommand, consentRevokeCommand, consentStatusCommand } from './consent';
import { Client } from 'discord.js';

export interface CommandContext {
  sessionManager: SessionManager;
  consentManager: ConsentManager;
  storageManager: StorageManager;
  client: Client;
}

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | any;
  execute: (interaction: ChatInputCommandInteraction, context: CommandContext) => Promise<void>;
}

export const commands: Command[] = [
  consentCommand,
  consentRevokeCommand,
  consentStatusCommand,
  sessionStartCommand,
  sessionStopCommand,
  sessionStatusCommand,
  sessionGlossaryCommand,
  sessionGlossaryShowCommand,
  sessionDeleteCommand,
];
