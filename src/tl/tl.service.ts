import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { HTMLElement, parse } from 'node-html-parser';
import { CATEGORY } from 'src/enums/category';
import { REGIONS } from 'src/enums/regions';
import { Article } from 'src/types/article';
import { ServerStatus } from 'src/types/server-status';

@Injectable()
export class TlService {
  private readonly logger: Logger = new Logger(TlService.name);

  constructor() {}

  public async getGeneralNews(): Promise<Article[]> {
    const news = await this.getNews(CATEGORY.GENERAL);

    return news;
  }

  public async getUpdates(): Promise<Article[]> {
    const updates = await this.getNews(CATEGORY.UPDATES);

    return updates;
  }

  public async getLatestUpdate(): Promise<string> {
    const updates = await this.getUpdates();
    const latestUpdate = updates[0];

    if (!latestUpdate) {
      throw new Error('No updates found');
    }

    const { link } = latestUpdate;

    const htmlContent = await this.fetchPage(link);
    const article = this.getArticle(htmlContent);

    if (!article) {
      throw new Error('No article found');
    }

    this.logger.debug('Found article:', article.innerText);

    return article.innerText;
  }

  public async getServerStatus(region?: REGIONS): Promise<ServerStatus> {
    const tl =
      'https://www.playthroneandliberty.com/en-us/support/server-status';

    try {
      const htmlContent = await this.fetchPage(tl);

      if (!htmlContent) {
        throw new Error('Failed to fetch page');
      }

      if (region && !Object.values(REGIONS).includes(region)) {
        throw new Error(`Invalid region: ${region}`);
      }

      const result = {} as ServerStatus;

      for (const reg of Object.values(REGIONS)) {
        const regionDiv = this.getRegionDiv(htmlContent, reg);

        if ((region && reg !== region) || !regionDiv) {
          continue;
        }

        result[reg] = {
          servers: this.parseServers(regionDiv),
          timestamp: new Date().toISOString(),
        };
      }

      return result;
    } catch (error) {
      this.logger.error('Error fetching server status:', error);
      throw error;
    }
  }

  private async getNews(
    categoryFilter?: string,
    limit: number = 5,
  ): Promise<Article[]> {
    const baseUrl =
      'https://www.playthroneandliberty.com/en-us/news-load-more?page=';
    const allArticles: Article[] = [];

    try {
      for (let page = 1; page <= 2; page++) {
        const url = `${baseUrl}${page}`;
        this.logger.debug(`Fetching page ${page}`);

        const htmlContent = await this.fetchPage(url);
        if (!htmlContent) {
          break;
        }

        const articles = this.parseArticles(htmlContent);
        if (articles.length === 0) {
          this.logger.debug(`No articles found on page ${page}. Stopping.`);
          break;
        }

        allArticles.push(...articles);
      }

      let filteredArticles = allArticles;
      if (categoryFilter) {
        filteredArticles = allArticles.filter(
          (article) =>
            article.category.toLowerCase() === categoryFilter.toLowerCase(),
        );

        this.logger.debug(
          `Filtered articles for category '${categoryFilter}': ${filteredArticles.length}`,
        );
      }

      return filteredArticles.slice(0, limit);
    } catch (error) {
      this.logger.error('Error fetching news:', error);
      throw error;
    }
  }

  private async fetchPage(url: string): Promise<string> {
    try {
      const { data } = await axios.get<string>(url);

      return data;
    } catch (error) {
      this.logger.error('Error fetching page:', error);
      throw new Error('Failed to fetch page content');
    }
  }

  private getArticle(htmlContent: string): HTMLElement | null {
    const root = parse(htmlContent);
    return root.querySelector('article');
  }

  private getRegionDiv(
    htmlContent: string,
    region: string,
  ): HTMLElement | null {
    const root = parse(htmlContent);
    return root.querySelector(
      `div[data-regionid="${region}"]`,
    ) as HTMLElement | null;
  }

  private parseServers(
    regionDiv: HTMLElement,
  ): { name: string; status: string }[] {
    const servers: { name: string; status: string }[] = [];

    const serverItems = regionDiv.querySelectorAll(
      'div.ags-ServerStatus-content-serverStatuses-server-item',
    ) as HTMLElement[];

    serverItems.forEach((serverItem) => {
      const nameElement = serverItem.querySelector(
        'span.ags-ServerStatus-content-serverStatuses-server-item-label',
      ) as HTMLElement;

      const name = nameElement?.innerText.trim() || 'Unknown';

      const statusSvg = serverItem.querySelector('svg')?.innerHTML ?? '';
      const status = this.determineStatus(statusSvg);

      servers.push({ name, status });
    });

    return servers;
  }

  private parseArticles(htmlContent: string): Article[] {
    const root = parse(htmlContent);
    const articles: Article[] = [];

    const articleElements = root.querySelectorAll('div.ags-SlotModule');

    articleElements.forEach((article) => {
      const href = article.querySelector('a.ags-SlotModule-slotLink')
        ?.attributes.href;
      const title = article
        .querySelector('.ags-SlotModule-slotLink-info-heading--blog')
        ?.innerText.trim();
      const category = article
        .querySelector('.ags-SlotModule-slotLink-info-subheading--featured')
        ?.innerText.trim();
      const description = article
        .querySelector('.ags-SlotModule-slotLink-info-text--blog')
        ?.innerText.trim();

      if (href && title && category && description) {
        articles.push({
          link: `https://www.playthroneandliberty.com${href}`,
          title,
          category,
          description,
        });
      }
    });

    return articles;
  }

  private determineStatus(svgContent: string): string {
    if (svgContent.includes('24FF00')) return 'Good';
    if (svgContent.includes('FFF500')) return 'Busy';
    if (svgContent.includes('FF0000')) return 'Full';
    if (svgContent.includes('00F0FF')) return 'In-Maintenance';
    return 'Unknown';
  }
}
