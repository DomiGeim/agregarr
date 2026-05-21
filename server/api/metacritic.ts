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

const getCandidateSlugs = (title: string, year?: number): string[] => {
  const normalized = normalizeTitle(title);
  const base = toSlug(title);
  const withoutLeadingArticle = normalized.replace(/^(the|a|an)\s+/, '');
  const candidates = [
    base,
    year ? `${base}-${year}` : '',
    withoutLeadingArticle !== normalized
      ? withoutLeadingArticle.replace(/\s+/g, '-')
      : '',
    normalized.replace(/\bpart\b/g, 'pt').replace(/\s+/g, '-'),
  ].filter(Boolean);

  return [...new Set(candidates)];
};

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
    const category = mediaType === 'movie' ? 'movie' : 'tv';
    const candidateSlugs = getCandidateSlugs(title, year);
    const cacheKey = `${mediaType}:${candidateSlugs[0]}:${year || 'unknown'}`;
    const cached = this.cache.get<MetacriticRating | null>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    for (const slug of candidateSlugs) {
      const url = `https://www.metacritic.com/${category}/${slug}/`;

      try {
        const response = await axios.get<string>(url, {
          timeout: 10000,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent':
              'Mozilla/5.0 (compatible; Agregarr/2; +https://github.com/DomiGeim/agregarr)',
          },
          validateStatus: () => true,
        });

        if (response.status < 200 || response.status >= 400) {
          continue;
        }

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
          continue;
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
          continue;
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
        logger.debug('Failed to fetch Metacritic rating candidate', {
          label: 'Metacritic API',
          title,
          year,
          mediaType,
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.cache.set(cacheKey, null);
    return null;
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
