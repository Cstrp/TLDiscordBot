import { ApplicationCommandOptionType } from 'discord.js';

export type CommandType = {
  name: string;
  description: string;
  options?: {
    name: string;
    description: string;
    type: ApplicationCommandOptionType;
    required: boolean;
  }[];
};
