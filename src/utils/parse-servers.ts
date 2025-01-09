import { HTMLElement } from 'node-html-parser';
import { determineStatus } from './determine-status';

export const parseServers = (
  regionDiv: HTMLElement,
): { name: string; status: string }[] => {
  const servers: { name: string; status: string }[] = [];

  const serverItems = regionDiv.querySelectorAll(
    'div.ags-ServerStatus-content-serverStatuses-server-item',
  );

  serverItems.forEach((serverItem) => {
    const nameElement = serverItem.querySelector(
      'span.ags-ServerStatus-content-serverStatuses-server-item-label',
    ) as HTMLElement;

    const name = nameElement?.innerText.trim() || 'Unknown';

    const statusSvg = serverItem.querySelector('svg')?.innerHTML ?? '';
    const status = determineStatus(statusSvg);

    servers.push({ name, status });
  });

  return servers;
};
