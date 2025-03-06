import { HTMLElement, parse } from 'node-html-parser';

export const getArticle = (htmlContent: string): HTMLElement | null => {
  const root = parse(htmlContent);

  return root.querySelector('article') ?? null;
};
