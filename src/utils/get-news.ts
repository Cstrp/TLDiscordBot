import { Logger } from '@nestjs/common';
import { Article } from 'src/types/article';
import { fetchPage } from './fetch-page';
import { parseArticles } from './parse-articles';

export const getNews = async (
  baseUrl: string,
  logger: Logger,
  categoryFilter?: string,
  limit: number = 5,
): Promise<Article[]> => {
  const allArticles: Article[] = [];

  try {
    for (let page = 1; page <= 2; page++) {
      const url = `${baseUrl}${page}`;

      const htmlContent = await fetchPage(url);
      if (!htmlContent) {
        break;
      }

      const articles = parseArticles(htmlContent);
      if (articles.length === 0) {
        logger.debug(`No articles found on page ${page}. Stopping.`);
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

      logger.debug(
        `Filtered articles for category '${categoryFilter}': ${filteredArticles.length}`,
      );
    }

    return filteredArticles.slice(0, limit);
  } catch (error) {
    logger.error('Error fetching news:', error);
    throw error;
  }
};
