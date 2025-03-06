import { HTMLElement, parse } from 'node-html-parser';

export const getRegionDiv = (
  htmlContent: string,
  region: string,
): HTMLElement | null => {
  const root = parse(htmlContent);

  return root.querySelector(`div[data-regionid="${region}"]`) ?? null;
};
