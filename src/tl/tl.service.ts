import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { HTMLElement, parse } from 'node-html-parser';
import { REGIONS } from 'src/enums/regions';
import { ServerStatus } from 'src/types/server-status';

@Injectable()
export class TlService {
  private readonly logger: Logger = new Logger(TlService.name);

  constructor() {}

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

  private async fetchPage(url: string): Promise<string> {
    try {
      const { data } = await axios.get<string>(url);
      return data;
    } catch (error) {
      this.logger.error('Error fetching page:', error);
      throw new Error('Failed to fetch page content');
    }
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

  private determineStatus(svgContent: string): string {
    if (svgContent.includes('24FF00')) return 'Good';
    if (svgContent.includes('FFF500')) return 'Busy';
    if (svgContent.includes('FF0000')) return 'Full';
    if (svgContent.includes('00F0FF')) return 'In-Maintenance';
    return 'Unknown';
  }
}
