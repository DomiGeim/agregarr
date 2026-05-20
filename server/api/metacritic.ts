import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import axios from 'axios';
import { JSDOM } from 'jsdom';

export interface MetacriticRating {
  title: string;
  year?: number;
  metascore: number;
  url: string;
}

const normalizeTitle = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const toSlug = (value: string): string =>
  normalizeTitle(value).replace(/\s+/g, '-');

const extractJsonScore = (html: string): number | undefined => {
  const matches = html.matchAll(
    /"(?:metaScore|metascore|criticScore|score)"\s*:\s*"?(\d{1,3})"?/gi
  );

  for (const match of matches) {
    const value = Number(match[1]);
    if (value >= 0 && value <= 100) {
      return value;
    }
  }

  return undefined;
};

class MetacriticAPI {
  private cache = cacheManager.getCache('metacritic').data;

  private async fetchRating(
    mediaType: 'movie' | 'tv',
    title: string,
    year?: number
  ): Promise<MetacriticRating | null> {
    const slug = toSlug(title);
    const category = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `https://www.metacritic.com/${category}/${slug}/`;
    const cacheKey = `${mediaType}:${slug}:${year || 'unknown'}`;
    const cached = this.cache.get<MetacriticRating | null>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    try {
      const response = await axios.get<string>(url, {
        timeout: 10000,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent':
            'Mozilla/5.0 (compatible; Agregarr/2; +https://github.com/DomiGeim/agregarr)',
        },
      });

      const dom = new JSDOM(response.data);
      const documentTitle =
        dom.window.document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute('content') ||
        dom.window.document.querySelector('title')?.textContent ||
        title;
      const pageText = dom.window.document.body?.textContent || '';
      const score =
        extractJsonScore(response.data) ||
        Number(
          dom.window.document
            .querySelector('[class*="metascore"], [data-testid*="score"]')
            ?.textContent?.match(/\b(\d{1,3})\b/)?.[1]
        );

      if (!score || score < 0 || score > 100) {
        this.cache.set(cacheKey, null);
        return null;
      }

      if (year && !pageText.includes(String(year))) {
        logger.debug('Metacritic page did not contain requested year', {
          label: 'Metacritic API',
          title,
          year,
          url,
        });
      }

      const normalizedRequested = normalizeTitle(title);
      const normalizedPage = normalizeTitle(documentTitle);
      if (
        !normalizedPage.includes(normalizedRequested) &&
        !normalizedRequested.includes(normalizedPage)
      ) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const rating = {
        title: documentTitle.replace(/\s+-\s+Metacritic.*$/i, '').trim(),
        year,
        metascore: score,
        url,
      };

      this.cache.set(cacheKey, rating);
      return rating;
    } catch (error) {
      logger.debug('Failed to fetch Metacritic rating', {
        label: 'Metacritic API',
        title,
        year,
        mediaType,
        error: error instanceof Error ? error.message : String(error),
      });
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  public async getMovieRating(
    title: string,
    year?: number
  ): Promise<MetacriticRating | null> {
    return this.fetchRating('movie', title, year);
  }

  public async getTVRating(
    title: string,
    year?: number
  ): Promise<MetacriticRating | null> {
    return this.fetchRating('tv', title, year);
  }
}

export default MetacriticAPI;
