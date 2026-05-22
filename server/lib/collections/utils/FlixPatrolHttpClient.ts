import logger from '@server/logger';
import axios, { type AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export class FlixPatrolHttpClient {
  private static instance: AxiosInstance | null = null;
  private static cookieJar: CookieJar | null = null;

  private static getInstance(): AxiosInstance {
    if (!this.instance) {
      this.cookieJar = new CookieJar();
      this.instance = wrapper(
        axios.create({
          jar: this.cookieJar,
          withCredentials: true,
          timeout: 15000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            Connection: 'keep-alive',
          },
        })
      );
    }

    return this.instance;
  }

  static async fetchPage(url: string): Promise<string> {
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.getInstance().get<string>(url, {
          responseType: 'text',
        });
        const html = response.data;

        if (
          response.status === 403 ||
          response.status === 503 ||
          (html.includes('cf-challenge') &&
            html.toLowerCase().includes('cloudflare'))
        ) {
          throw new Error('FlixPatrol challenge detected');
        }

        return html;
      } catch (error) {
        const blocked =
          error instanceof Error &&
          error.message === 'FlixPatrol challenge detected';
        const blockedStatus =
          axios.isAxiosError(error) &&
          (error.response?.status === 403 || error.response?.status === 503);

        if ((blocked || blockedStatus) && attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt);
          logger.warn(
            `FlixPatrol plain HTTP blocked, retrying in ${delayMs}ms`,
            {
              label: 'FlixPatrol HTTP',
              url,
              attempt: attempt + 1,
              status: axios.isAxiosError(error)
                ? error.response?.status
                : 'challenge',
            }
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        logger.warn('FlixPatrol plain HTTP fetch failed', {
          label: 'FlixPatrol HTTP',
          url,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    throw new Error('FlixPatrol plain HTTP fetch exhausted retries');
  }
}
