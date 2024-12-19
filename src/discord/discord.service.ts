import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Client, TextChannel } from 'discord.js';
import {
  Context,
  ContextOf,
  On,
  Once,
  Options,
  SlashCommand,
  SlashCommandContext,
} from 'necord';
import { REGIONS } from 'src/enums/regions';
import { STATUS } from 'src/enums/status';
import { TlService } from 'src/tl/tl.service';
import { RegionOptionsDto } from './options.dto';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private stopJob: boolean = false;

  constructor(
    private readonly tl: TlService,
    private readonly client: Client,
    private readonly cfg: ConfigService,
  ) {}

  @Cron('0 * * * 4') // EVERY HOUR ON THURSDAYS
  public async onSchedule() {
    if (this.stopJob) {
      this.logger.verbose(
        'All servers are in good condition. Cron task aborted.',
      );
      return;
    }

    const result = await this.checkServerStatus();
    this.sendMessage(result);
  }

  @Once('ready')
  public async onReady(@Context() [ctx]: ContextOf<'ready'>) {
    this.logger.verbose(`Bot logged in as ${ctx.user.username}`);
  }

  @SlashCommand({
    name: 'health',
    description: 'Check bot health ',
  })
  public async onHealth(@Context() [ctx]: SlashCommandContext) {
    try {
      await ctx.editReply('Bot is healthy');
    } catch (error) {
      this.logger.error(error);
    }
  }

  @SlashCommand({
    name: 'check',
    description: 'Check TL server statuses for a specific region',
  })
  public async onSlashCheck(
    @Context() [ctx]: SlashCommandContext,
    @Options() { region }: RegionOptionsDto,
  ) {
    this.logger.verbose(`Selected region ${region}`);

    try {
      if (typeof ctx.deferReply === 'function') {
        await ctx.deferReply();
      }

      const selectedRegion = region as REGIONS;

      if (!selectedRegion) {
        await ctx.editReply('Invalid region specified.');
        return;
      }

      const result = await this.tl.getServerStatus(selectedRegion);

      if (!result) {
        await ctx.editReply('No server status data available.');
        return;
      }

      const operationalServers: string[] = [];
      const serversInMaintenance: string[] = [];

      result[selectedRegion].servers.forEach((server) => {
        const status =
          {
            Good: STATUS.GOOD,
            Busy: STATUS.BUSY,
            Full: STATUS.FULL,
            'In-Maintenance': STATUS.IN_MAINTENANCE,
            Unknown: STATUS.UNKNOWN,
          }[server.status] ?? STATUS.UNKNOWN;

        const formattedServer = `**${server.name}**: ${status}`;

        if (server.status === 'Good') {
          operationalServers.push(formattedServer);
        } else {
          serversInMaintenance.push(formattedServer);
        }
      });

      let reply = `**Region:** ${selectedRegion.toUpperCase()}\n\n`;

      if (operationalServers.length > 0) {
        reply += `🟢 **Operational Servers**\n`;
        operationalServers.forEach((server) => {
          reply += `- ${server}\n`;
        });
      }

      if (serversInMaintenance.length > 0) {
        reply += `🔵 **Servers in Maintenance**\n`;
        serversInMaintenance.forEach((server) => {
          reply += `- ${server}\n`;
        });
      }

      const otherServers = result[selectedRegion].servers.filter(
        (server) => !['Good', 'In-Maintenance'].includes(server.status),
      );

      if (otherServers.length > 0) {
        reply += `⚪ **Other Servers (Busy, Full, Unknown)**\n`;
        otherServers.forEach((server) => {
          const status =
            {
              Good: STATUS.GOOD,
              Busy: STATUS.BUSY,
              Full: STATUS.FULL,
              'In-Maintenance': STATUS.IN_MAINTENANCE,
              Unknown: STATUS.UNKNOWN,
            }[server.status] ?? STATUS.UNKNOWN;
          reply += `- **${server.name}**: ${status}\n`;
        });
      }

      await ctx.editReply(reply);
    } catch (error) {
      this.logger.error(`Error responding to /check command: ${error.message}`);
      await ctx.editReply(
        'An error occurred while fetching the server status. Please try again later.',
      );
    }
  }

  @On('interactionCreate')
  public async onInteractionCreate(
    @Context() [interaction]: ContextOf<'interactionCreate'>,
  ): Promise<void> {
    if (!interaction.isAutocomplete()) return;

    const focusedOption = interaction.options.getFocused(true);
    let choices: string[] = [];

    if (focusedOption.name === 'region') {
      const focusedValue = focusedOption.value as string;
      choices = Object.values(REGIONS)
        .filter((region) =>
          region.toLowerCase().includes(focusedValue.toLowerCase()),
        )
        .map((region) => region);
    }

    await interaction.respond(
      choices.slice(0, 25).map((choice) => ({
        name: choice.toUpperCase(),
        value: choice,
      })),
    );
  }

  private async sendMessage(message: string): Promise<void> {
    if (!this.client || !this.client.channels) {
      this.logger.error(
        'Discord client is not ready or channels are not available.',
      );
      return;
    }

    try {
      await this.client.login();
      const channel_id = this.cfg.get('CHANNEL_ID') ?? '';
      const channel = (await this.client.channels.fetch(
        channel_id,
      )) as TextChannel;

      await channel.send(message);
    } catch (error) {
      this.logger.error(
        `Error while trying send message to Discord: ${error.message}`,
      );
    }
  }

  private async checkServerStatus(): Promise<string> {
    const defaultRegion = REGIONS.EUROPE;
    const statuses = await this.tl.getServerStatus(defaultRegion);

    let condition = true;
    let message = `**Region:** ${defaultRegion}\n\n`;

    const templates = {
      GOOD: (serverName: string) => `___${serverName}___: ${STATUS.GOOD}.`,
      MAINTENANCE: (serverName: string) =>
        `___${serverName}___: ${STATUS.IN_MAINTENANCE}`,
      BAD: (serverName: string, status: string) =>
        `___${serverName}___ is experiencing issues. Status: ${status}`,
    };

    for (const { status, name } of statuses.europe.servers) {
      if (status === 'Good') {
        message += templates.GOOD(name);
        this.logger.log(`Server ${name} is good.`);
      } else if (status === 'In-Maintenance') {
        message += templates.MAINTENANCE(name);
        this.logger.warn(`Server ${name} is in maintenance.`);
        condition = false;
      } else {
        message += templates.BAD(name, status);
        this.logger.warn(
          `Server ${name} is not in good status. Status: ${status}`,
        );
        condition = false;
      }
      message += '\n';
    }

    if (condition) {
      message += '\n✅ All servers are in good condition.';
      this.logger.log('All servers are in good condition.');
      this.stopJob = true;
    } else {
      message +=
        '\n⚠️ Some servers are not in good condition. Cron job will check again next time.';
      this.logger.log(
        'Some servers are not in good condition. Continuing job....',
      );
    }

    return message;
  }
}
