import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CATEGORY } from 'src/enums/category';
import { REGIONS } from 'src/enums/regions';
import { Article } from 'src/types/article';
import { ServerStatus } from 'src/types/server-status';
import { getArticle } from 'src/utils/get-article';
import { getNews } from 'src/utils/get-news';
import { getRegionDiv } from 'src/utils/get-region-div';
import { getUpcomingDayNightTimes } from 'src/utils/get-upcoming-day-night-times';
import { parseServers } from 'src/utils/parse-servers';
import { fetchPage } from './../utils/fetch-page';

@Injectable()
export class TlService {
  private readonly logger: Logger = new Logger(TlService.name);

  constructor(private readonly cfg: ConfigService) {
    this.getRainSchedule();
  }

  public async getRainSchedule(): Promise<void> {
    try {
      getUpcomingDayNightTimes();
    } catch (error) {
      this.logger.error('Error fetching rain schedule:', error.message);
    }
  }

  public async getNightSchedule(): Promise<void> {
    // const url = this.cfg.get<string>('NIGHT_SCHEDULE_URL') ?? '';
    // TODO: Implement this method
  }

  public async getGeneralNews(): Promise<Article[]> {
    const baseUrl = this.cfg.get<string>('TL_NEWS_URL') ?? '';

    const news = await getNews(baseUrl, this.logger, CATEGORY.GENERAL);

    return news;
  }

  public async getUpdates(): Promise<Article[]> {
    const baseUrl = this.cfg.get<string>('TL_NEWS_URL') ?? '';

    const updates = await getNews(baseUrl, this.logger, CATEGORY.UPDATES);

    return updates;
  }

  public async getLatestUpdate(): Promise<string> {
    const updates = await this.getUpdates();
    const latestUpdate = updates[0];

    if (!latestUpdate) {
      throw new Error('No updates found');
    }

    const { link } = latestUpdate;

    const htmlContent = await fetchPage(link);
    const article = getArticle(htmlContent);

    if (!article) {
      throw new Error('No article found');
    }

    this.logger.debug('Found article:', article.innerText);

    return article.innerText;
  }

  public async getServerStatus(region?: REGIONS): Promise<ServerStatus> {
    const url = this.cfg.get<string>('TL_SERVER_STATUS_URL') ?? '';

    try {
      const htmlContent = await fetchPage(url);

      if (!htmlContent) {
        throw new Error('Failed to fetch page');
      }

      if (region && !Object.values(REGIONS).includes(region)) {
        throw new Error(`Invalid region: ${region}`);
      }

      const result = {} as ServerStatus;

      for (const reg of Object.values(REGIONS)) {
        const regionDiv = getRegionDiv(htmlContent, reg);

        if ((region && reg !== region) || !regionDiv) {
          continue;
        }

        result[reg] = {
          servers: parseServers(regionDiv),
          timestamp: new Date().toISOString(),
        };
      }

      return result;
    } catch (error) {
      this.logger.error('Error fetching server status:', error);
      throw error;
    }
  }
}
