import { parse } from 'node-html-parser';
import { Article } from 'src/types/article';

export const parseArticles = (htmlContent: string): Article[] => {
  const root = parse(htmlContent);
  const articles: Article[] = [];

  const articleElements = root.querySelectorAll('div.ags-SlotModule');

  articleElements.forEach((article) => {
    const href = article.querySelector('a.ags-SlotModule-slotLink')?.attributes
      .href;
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
};
