import { Injectable, Logger, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Client, TextChannel } from 'discord.js';

import {
  Context,
  ContextOf,
  Once,
  Options,
  SlashCommand,
  SlashCommandContext,
} from 'necord';
import { CATEGORY } from 'src/enums/category';
import { REGIONS } from 'src/enums/regions';
import { STATUS } from 'src/enums/status';
import { LangchainService } from 'src/langchain/langchain.service';
import { MistralService } from 'src/mistral/mistral.service';
import { TlService } from 'src/tl/tl.service';
import { Article } from 'src/types/article';
import { CategoryOptionsDto } from './dto/category.dto';
import { RegionOptionsDto } from './dto/options.dto';
import { SearchOptionsDto } from './dto/search-options.dto';
import { CategoryAutocompleteInterceptor } from './interceptors/category.interceptor';
import { RegionAutocompleteInterceptor } from './interceptors/region.interceptor';

@Injectable()
export class DiscordService {
  private readonly logger: Logger = new Logger(DiscordService.name);
  private stopJob: boolean = false;

  constructor(
    private readonly langchain: LangchainService,
    private readonly mistral: MistralService,
    private readonly tlService: TlService,
    private readonly cfg: ConfigService,
    private readonly client: Client,
  ) {}

  @Once('ready')
  public async onReady(@Context() [ctx]: ContextOf<'ready'>) {
    this.logger.verbose(`Bot logged in as ${ctx.user.username}`);
  }

  @Once('warn')
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

  @Cron('0 */30 * * * 4')
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

  @Cron('0 */30 * * * 4', { name: 'checkServerStatus' })
  public async checkServerStatusCron() {
    if (this.stopJob) {
      this.logger.debug(
        'Check skipped: All servers previously confirmed operational',
      );
      return;
    }

    const statusMessage = await this.checkServerStatus();
    await this.sendMessage(statusMessage);
  }

  @SlashCommand({
    name: 'search',
    description: 'Grant AI network access, and get some info from duck-duck-go',
  })
  public async onSearch(
    @Context() [ctx]: SlashCommandContext,
    @Options() { query }: SearchOptionsDto,
  ) {
    try {
      await ctx.deferReply();

      const answer = await this.langchain.askQuestion(query);

      const truncatedAnswer =
        answer.length > 2000 ? answer.slice(0, 1997) + '...' : answer;

      await ctx.editReply({ content: truncatedAnswer });
    } catch (error) {
      this.logger.error(
        `Error processing search command for query "${query}": ${error.message}`,
        error.stack,
      );
      await ctx.editReply({
        content: 'An error occured... please try again',
      });
    }
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

  private async checkServerStatus(): Promise<string> {
    const region = REGIONS.EUROPE;
    let statusMessage = `**Region: ${region.toUpperCase()}**\n\n`;

    try {
      const serverStatus = await this.tlService.getServerStatus(region);
      if (!serverStatus || !serverStatus[region]?.servers) {
        this.logger.warn(`No server data available for ${region}`);
        return `${statusMessage}⚠️ No server data available at this time.`;
      }

      const servers = serverStatus[region].servers;
      const operationalServers: string[] = [];
      const maintenanceServers: string[] = [];

      servers.forEach((server) => {
        const statusLabel = this.getStatusLabel(server.status);
        const formatted = `${server.name}: ${statusLabel}`;

        if (server.status === 'Good') {
          operationalServers.push(formatted);
        } else if (server.status === 'In-Maintenance') {
          maintenanceServers.push(formatted);
        } else {
          operationalServers.push(formatted);
        }
      });

      if (maintenanceServers.length === servers.length) {
        statusMessage += '🛠️ All servers are currently under maintenance.';
        this.logger.warn('All servers are in maintenance');
      } else if (operationalServers.length > 0) {
        // Хотя бы один сервер активен
        statusMessage += '🖥️ **Server Status**\n';
        if (operationalServers.length > 0) {
          statusMessage +=
            '✅ Operational:\n' +
            operationalServers.map((s) => `- ${s}`).join('\n') +
            '\n';
        }
        if (maintenanceServers.length > 0) {
          statusMessage +=
            '🛠️ Maintenance:\n' +
            maintenanceServers.map((s) => `- ${s}`).join('\n');
        }
        this.stopJob = servers.every((s) => s.status === 'Good');
        this.logger.verbose(
          `Server status: ${operationalServers.length} operational, ${maintenanceServers.length} in maintenance`,
        );
      } else {
        statusMessage +=
          '⚠️ Unexpected status: No operational servers detected.';
        this.logger.warn('Unexpected server status configuration');
      }

      return statusMessage;
    } catch (error) {
      this.logger.error(
        `Failed to check server status: ${error.message}`,
        error.stack,
      );
      return `${statusMessage}❌ Error fetching server status.`;
    }
  }

  private getStatusLabel(status: string): string {
    return (
      {
        Good: STATUS.GOOD,
        Busy: STATUS.BUSY,
        Full: STATUS.FULL,
        'In-Maintenance': STATUS.IN_MAINTENANCE,
        Unknown: STATUS.UNKNOWN,
      }[status] ?? STATUS.UNKNOWN
    );
  }

  private async sendMessage(message: string): Promise<void> {
    const channelId = this.cfg.get<string>('CHANNEL_ID');
    if (!channelId) {
      this.logger.error('CHANNEL_ID is not configured');
      return;
    }

    try {
      const channel = (await this.client.channels.fetch(
        channelId,
      )) as TextChannel;
      if (!channel) {
        this.logger.error(`Channel ${channelId} not found`);
        return;
      }
      await channel.send({ content: message });
      this.logger.debug(
        `Message sent to channel ${channelId}: ${message.slice(0, 50)}...`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send message to Discord: ${error.message}`,
        error.stack,
      );
    }
  }
}
