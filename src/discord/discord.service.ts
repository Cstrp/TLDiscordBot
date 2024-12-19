import { Injectable, Logger, UseInterceptors } from '@nestjs/common';
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
import { CATEGORY } from 'src/enums/category';
import { REGIONS } from 'src/enums/regions';
import { STATUS } from 'src/enums/status';
import { MistralService } from 'src/mistral/mistral.service';
import { TlService } from 'src/tl/tl.service';
import { Article } from 'src/types/article';
import { CategoryOptionsDto } from './dto/category.dto';
import { RegionOptionsDto } from './dto/options.dto';
import { CategoryAutocompleteInterceptor } from './interceptors/category.interceptor';
import { RegionAutocompleteInterceptor } from './interceptors/region.interceptor';

@Injectable()
export class DiscordService {
  private readonly logger: Logger = new Logger(DiscordService.name);
  private stopJob: boolean = false;

  constructor(
    private readonly mistral: MistralService,
    private readonly tlService: TlService,
    private readonly client: Client,
    private readonly cfg: ConfigService,
  ) {}

  @Once('ready')
  public async onReady(@Context() [ctx]: ContextOf<'ready'>) {
    this.logger.verbose(`Bot logged in as ${ctx.user.username}`);
  }

  @On('warn')
  public onWarn(@Context() [message]: ContextOf<'warn'>) {
    this.logger.warn(message);
  }

  @SlashCommand({
    name: 'health',
    description: 'Health command',
  })
  public onHealth(@Context() [ctx]: SlashCommandContext) {
    const content = '[Throne and Liberty] Bot is healthy';

    return ctx.reply({ content });
  }

  @Cron('0 0 * * * 5')
  public async onResetJob() {
    this.stopJob = false;
  }

  @Cron('0 */30 * * * 4') // EVERY 30 MINUTES ON THURSDAYS
  public async onCheckSilent() {
    if (this.stopJob) {
      this.logger.verbose(
        'All servers are in good condition. Cron task aborted.',
      );
      return;
    }

    const result = await this.checkServerStatus();

    if (result.includes('✅ All servers are in good condition.')) {
      this.sendMessage(result);
      this.stopJob = true;
    } else {
      this.logger.warn('Some servers are not in good condition.');
    }
  }

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

  @SlashCommand({
    name: 'latest_update',
    description: 'Get latest update news with Mistral translation',
  })
  public async onLatestUpdate(@Context() [ctx]: SlashCommandContext) {
    try {
      await ctx.deferReply();

      const latestUpdate = await this.tlService.getLatestUpdate();
      const translatedUpdate = await this.mistral.translateNews(latestUpdate);

      const splitMessage = (message: string): string[] => {
        const messages: string[] = [];
        let currentMessage = '';
        const words = message.split(' ');

        words.forEach((word) => {
          if (currentMessage.length + word.length + 1 <= 2000) {
            currentMessage += (currentMessage ? ' ' : '') + word;
          } else {
            messages.push(currentMessage);
            currentMessage = word;
          }
        });

        if (currentMessage) {
          messages.push(currentMessage);
        }

        return messages;
      };

      const formattedUpdate = splitMessage(translatedUpdate);

      for (const message of formattedUpdate) {
        await ctx.followUp({
          content: message,
        });
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  @UseInterceptors(CategoryAutocompleteInterceptor)
  @SlashCommand({
    name: 'news',
    description: 'Get latest news',
  })
  public async onNews(
    @Context() [ctx]: SlashCommandContext,
    @Options() { category }: CategoryOptionsDto,
  ) {
    try {
      const selectedCategory = category as CATEGORY;
      let news: Article[] = [];

      switch (selectedCategory) {
        case CATEGORY.GENERAL:
          news = await this.tlService.getGeneralNews();
          break;
        case CATEGORY.UPDATES:
          news = await this.tlService.getUpdates();
          break;
        default:
          news = [];
      }

      if (news.length > 0) {
        let replyContent = `**Latest News for ${selectedCategory}**\n\n`;

        for (let i = 0; i < news.length; i++) {
          replyContent += `**${i + 1}. ${news[i].title}**\n`;
          replyContent += `${news[i].description}\n`;
          replyContent += `[Read more](${news[i].link})\n\n`;

          if (replyContent.length > 2000) {
            try {
              await ctx.reply({ content: replyContent });
            } catch (error) {
              this.logger.error('Error sending message:', error);
            }

            replyContent = '';
          }
        }

        if (replyContent.length > 0) {
          try {
            await ctx.reply({ content: replyContent });
          } catch (error) {
            this.logger.error('Error sending final message:', error);
          }
        }
      } else {
        try {
          await ctx.reply({
            content: 'No news found for the selected category.',
          });
        } catch (error) {
          this.logger.error('Error sending no news message:', error);
        }
      }
    } catch (error) {
      this.logger.error('Error fetching news:', error);
      try {
        await ctx.reply({
          content:
            'An error occurred while fetching the news. Please try again later.',
        });
      } catch (replyError) {
        this.logger.error('Error sending error message:', replyError);
      }
    }
  }

  @UseInterceptors(RegionAutocompleteInterceptor)
  @SlashCommand({
    name: 'check',
    description: 'Check server status',
  })
  public async onCheck(
    @Context() [ctx]: SlashCommandContext,
    @Options() { region }: RegionOptionsDto,
  ) {
    try {
      const selectedRegion = region as REGIONS;
      const result = await this.tlService.getServerStatus(selectedRegion);

      if (
        !result ||
        !result[selectedRegion] ||
        !result[selectedRegion].servers
      ) {
        await ctx.reply(
          'No server data available for the selected region. Please try again later.',
        );

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
      await ctx.reply({
        content: reply,
        options: {
          embeds: [],
          fetchReply: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error responding to /check command: ${error.message}`);
      if (typeof ctx.editReply === 'function') {
        await ctx.editReply(
          'An error occurred while fetching the server status. Please try again later.',
        );
      }
    }
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
      this.logger.error('Error sending message:', error);
    }
  }

  private async checkServerStatus(): Promise<string> {
    const defaultRegion = REGIONS.EUROPE;
    const statuses = await this.tlService.getServerStatus(defaultRegion);
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
      switch (status) {
        case 'Good':
          message += templates.GOOD(name);
          this.logger.warn(`Server ${name} is good.`);
          break;
        case 'In-Maintenance':
          message += templates.MAINTENANCE(name);
          this.logger.warn(`Server ${name} is in maintenance.`);
          condition = false;
          break;
        default:
          message += templates.BAD(name, status);
          this.logger.warn(
            `Server ${name} is not in good status. Status: ${status}`,
          );
          condition = false;
          break;
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

//   @SlashCommand({
//     name: 'get_latest_update',
//     description: 'Get latest update',
//   })
//   public async onGetLatestUpdate(@Context() [ctx]: SlashCommandContext) {
//     if (typeof ctx.deferReply === 'function') {
//       ctx.deferReply().catch((error) => {
//         this.logger.error(error);
//       });
//     }

//     try {
//       const latestUpdate = await this.tl.getLatestUpdate();

//       const translatedUpdate = await this.mistral.translateNews(latestUpdate);
//       const chunks = this.splitTextIntoChunks(translatedUpdate);

//       for (const chunk of chunks) {
//         await ctx.reply({
//           content: chunk,
//           options: {
//             tts: false,
//             allowedMentions: { parse: [] },
//             fetchReply: true,
//           },
//         });
//       }
//     } catch (error) {
//       this.logger.error(error);
//     }
//   }

//   @SlashCommand({
//     name: 'check',
//     description: 'Check TL server statuses for a specific region',
//   })
//   public async onSlashCheck(
//     @Context() [ctx]: SlashCommandContext,
//     @Options() { region }: RegionOptionsDto,
//   ) {

//   }

//   @On('interactionCreate')
//   public async onInteractionCreate(
//     @Context() [interaction]: ContextOf<'interactionCreate'>,
//   ): Promise<void> {
//     if (!interaction.isAutocomplete()) return;

//     const focusedOption = interaction.options.getFocused(true);
//     let choices: string[] = [];

//     if (focusedOption.name === 'region') {
//       const focusedValue = focusedOption.value as string;
//       choices = Object.values(REGIONS)
//         .filter((region) =>
//           region.toLowerCase().includes(focusedValue.toLowerCase()),
//         )
//         .map((region) => region);
//     }

//     await interaction.respond(
//       choices.slice(0, 25).map((choice) => ({
//         name: choice.toUpperCase(),
//         value: choice,
//       })),
//     );
//   }

//   private async sendMessage(message: string): Promise<void> {
//     if (!this.client || !this.client.channels) {
//       this.logger.error(
//         'Discord client is not ready or channels are not available.',
//       );
//       return;
//     }

//     try {
//       await this.client.login();
//       const channel_id = this.cfg.get('CHANNEL_ID') ?? '';
//       const channel = (await this.client.channels.fetch(
//         channel_id,
//       )) as TextChannel;

//       await channel.send(message);
//     } catch (error) {
//       this.logger.error(
//         `Error while trying send message to Discord: ${error.message}`,
//       );
//     }
//   }

//   private splitTextIntoChunks(text: string): string[] {
//     const maxLength = 2000;
//     const chunks = [];
//     let start = 0;

//     while (start < text.length) {
//       const end = Math.min(start + maxLength, text.length);

//       let breakPoint = text.lastIndexOf('\n', end);

//       if (breakPoint === -1 || breakPoint <= start) {
//         breakPoint = end;
//       }

//       chunks.push(text.slice(start, breakPoint).trim());

//       start = breakPoint;
//     }

//     return chunks.map((chunk) => {
//       if (chunk.length > maxLength) {
//         return chunk.slice(0, maxLength);
//       }
//       return chunk;
//     });
//   }
