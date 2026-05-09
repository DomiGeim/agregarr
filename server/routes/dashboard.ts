import TautulliAPI from '@server/api/tautulli';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';

const dashboardRoutes = Router();
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const TAUTULLI_DASHBOARD_TIMEOUT_MS = 8000;

const dashboardCache = new Map<
  string,
  {
    expiresAt: number;
    data: unknown;
  }
>();

const getCachedDashboardData = <T>(key: string): T | null => {
  const cached = dashboardCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    dashboardCache.delete(key);
    return null;
  }

  return cached.data as T;
};

const setCachedDashboardData = <T>(key: string, data: T): void => {
  dashboardCache.set(key, {
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    data,
  });
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(timeoutMessage)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const getCollectionRatingKeys = (settings: ReturnType<typeof getSettings>) => {
  const collectionRatingKeys: string[] = [];

  if (settings.plex.collectionConfigs) {
    for (const config of settings.plex.collectionConfigs) {
      if (config.collectionRatingKey) {
        collectionRatingKeys.push(config.collectionRatingKey);
      }
    }
  }

  if (settings.plex.preExistingCollectionConfigs) {
    for (const config of settings.plex.preExistingCollectionConfigs) {
      if (config.collectionRatingKey) {
        collectionRatingKeys.push(config.collectionRatingKey);
      }
    }
  }

  return [...new Set(collectionRatingKeys)];
};

/**
 * GET /api/v1/dashboard/stats
 * Get dashboard statistics including collection stats, user activity, etc.
 */
dashboardRoutes.get('/stats', isAuthenticated(), async (req, res) => {
  try {
    const settings = getSettings();
    const collectionRatingKeys = getCollectionRatingKeys(settings);
    const cacheKey = `stats:${collectionRatingKeys.join(',')}`;
    const cachedDashboardData = getCachedDashboardData(cacheKey);

    if (cachedDashboardData) {
      return res.status(200).json(cachedDashboardData);
    }

    let tautulliStats = null;
    let collectionStatsData = null;
    let weeklyStats = null;

    // Get Tautulli stats if configured
    if (settings.tautulli.hostname && settings.tautulli.apiKey) {
      try {
        const tautulli = new TautulliAPI(settings.tautulli);

        // Get collection stats and weekly activity stats
        const [collectionStats, weeklyMovies, weeklyTV] = await withTimeout(
          Promise.all([
            tautulli
              .getTopCollections(50, 'plays', 7, collectionRatingKeys, {
                includeMetadata: false,
                includeUserStats: false,
                concurrency: 6,
              })
              .catch((err) => {
                logger.warn('Failed to get collection stats from Tautulli', {
                  label: 'Dashboard API',
                  error: err.message,
                });
                return [];
              }),
            tautulli.getHomeStats(7, 'plays', 'top_movies', 10).catch(() => []),
            tautulli.getHomeStats(7, 'plays', 'top_tv', 10).catch(() => []),
          ]),
          TAUTULLI_DASHBOARD_TIMEOUT_MS,
          'Tautulli dashboard request timed out'
        );

        // Calculate weekly plays from server totals
        let moviePlaysCount = 0;
        let tvPlaysCount = 0;

        weeklyMovies.forEach((item) => {
          moviePlaysCount += item.total_plays || 0;
        });

        weeklyTV.forEach((item) => {
          tvPlaysCount += item.total_plays || 0;
        });

        const totalWeeklyPlays = moviePlaysCount + tvPlaysCount;

        // Calculate collection-specific plays
        let collectionTotalPlays = 0;
        let collectionMoviePlays = 0;
        let collectionTvPlays = 0;

        collectionStats.forEach((collection) => {
          collectionTotalPlays += collection.total_plays;

          // Determine if it's a movie or TV collection based on media_type or title
          // This is a simple heuristic - could be improved with better metadata
          if (
            collection.media_type === 'movie' ||
            collection.title.toLowerCase().includes('movie') ||
            collection.title.toLowerCase().includes('film')
          ) {
            collectionMoviePlays += collection.total_plays;
          } else if (
            collection.media_type === 'show' ||
            collection.title.toLowerCase().includes('tv') ||
            collection.title.toLowerCase().includes('show') ||
            collection.title.toLowerCase().includes('series')
          ) {
            collectionTvPlays += collection.total_plays;
          } else {
            // If uncertain, split evenly or assign to TV (most collections are mixed)
            collectionTvPlays += collection.total_plays;
          }
        });

        collectionStatsData = {
          topCollections: collectionStats.slice(0, 5),
          totalCollections: collectionStats.length,
          collectionPlays: {
            total: collectionTotalPlays,
            movies: collectionMoviePlays,
            tv: collectionTvPlays,
          },
        };

        weeklyStats = {
          totalPlays: totalWeeklyPlays,
          moviePlays: moviePlaysCount,
          tvPlays: tvPlaysCount,
          collectionPlays: collectionTotalPlays,
        };

        tautulliStats = {
          isConnected: true,
          weeklyActivity: weeklyStats,
        };
      } catch (error) {
        logger.error('Failed to fetch Tautulli stats for dashboard', {
          label: 'Dashboard API',
          error: error.message,
        });
        tautulliStats = {
          isConnected: false,
          error: error.message,
          timedOut: error.message.includes('timed out'),
        };
      }
    }

    // Get collection configs count
    const agregarrCollectionCount =
      settings.plex.collectionConfigs?.length || 0;
    const preExistingCollectionCount =
      settings.plex.preExistingCollectionConfigs?.length || 0;

    const dashboardData = {
      mediaServer: {
        activeType: settings.plex.mediaServerType || 'plex',
        name: settings.plex.name,
        libraryCount: settings.plex.libraries?.length || 0,
        lastGlobalSyncAt: settings.main.lastGlobalSyncAt,
        globalSyncError: settings.main.globalSyncError,
        profiles: {
          plex: {
            configured: !!settings.plexProfile.ip,
            libraryCount: settings.plexProfile.libraries?.length || 0,
          },
          jellyfin: {
            configured: !!settings.jellyfin.ip,
            libraryCount: settings.jellyfin.libraries?.length || 0,
          },
        },
      },
      collections: {
        agregarr: agregarrCollectionCount,
        preExisting: preExistingCollectionCount,
        total: agregarrCollectionCount + preExistingCollectionCount,
        stats: collectionStatsData,
      },
      activity: weeklyStats,
      tautulli: tautulliStats,
      timestamp: new Date().toISOString(),
    };

    setCachedDashboardData(cacheKey, dashboardData);
    res.status(200).json(dashboardData);
  } catch (error) {
    logger.error('Failed to get dashboard stats', {
      label: 'Dashboard API',
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to get dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/dashboard/collections
 * Get detailed collection statistics from Tautulli
 */
dashboardRoutes.get('/collections', isAuthenticated(), async (req, res) => {
  try {
    const settings = getSettings();
    const { limit = 10, statType = 'plays', days = 30 } = req.query;
    const numericLimit = Number(limit);
    const numericDays = Number(days);

    if (!settings.tautulli.hostname || !settings.tautulli.apiKey) {
      return res.status(400).json({
        error: 'Tautulli not configured',
        message:
          'Tautulli settings are required to fetch collection statistics',
      });
    }

    const collectionRatingKeys = getCollectionRatingKeys(settings);
    const cacheKey = `collections:${numericLimit}:${statType}:${numericDays}:${collectionRatingKeys.join(
      ','
    )}`;
    const cachedCollectionData = getCachedDashboardData(cacheKey);

    if (cachedCollectionData) {
      return res.status(200).json(cachedCollectionData);
    }

    logger.info('Getting collection statistics', {
      label: 'Dashboard API',
      agregarrCollections: settings.plex.collectionConfigs?.length || 0,
      preExistingCollections:
        settings.plex.preExistingCollectionConfigs?.length || 0,
      ratingKeysFound: collectionRatingKeys.length,
      ratingKeys: collectionRatingKeys,
    });

    if (collectionRatingKeys.length === 0) {
      logger.warn('No collections with rating keys found', {
        label: 'Dashboard API',
      });
      return res.status(200).json({
        collections: [],
        metadata: {
          limit: numericLimit,
          statType,
          days: numericDays,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const tautulli = new TautulliAPI(settings.tautulli);
    const collections = await tautulli.getTopCollections(
      numericLimit,
      statType as 'plays' | 'duration',
      numericDays,
      collectionRatingKeys,
      { concurrency: 6 }
    );

    const collectionData = {
      collections,
      metadata: {
        limit: numericLimit,
        statType,
        days: numericDays,
        timestamp: new Date().toISOString(),
      },
    };

    setCachedDashboardData(cacheKey, collectionData);
    res.status(200).json(collectionData);
  } catch (error) {
    logger.error('Failed to get collection statistics', {
      label: 'Dashboard API',
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to get collection statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/dashboard/collections/:ratingKey
 * Get detailed statistics for a specific collection
 */
dashboardRoutes.get(
  '/collections/:ratingKey',
  isAuthenticated(),
  async (req, res) => {
    try {
      const settings = getSettings();
      const { ratingKey } = req.params;
      const { days = '1,7,30,0' } = req.query;

      if (!settings.tautulli.hostname || !settings.tautulli.apiKey) {
        return res.status(400).json({
          error: 'Tautulli not configured',
          message:
            'Tautulli settings are required to fetch collection statistics',
        });
      }

      const tautulli = new TautulliAPI(settings.tautulli);
      const collectionStats = await tautulli.getCollectionStats(
        ratingKey,
        String(days)
      );

      res.status(200).json({
        collection: collectionStats,
        metadata: {
          ratingKey,
          queryDays: String(days),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get collection statistics', {
        label: 'Dashboard API',
        error: error instanceof Error ? error.message : String(error),
        ratingKey: req.params.ratingKey,
      });

      res.status(500).json({
        error: 'Failed to get collection statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/dashboard/activity
 * Get recent activity and general statistics
 */
dashboardRoutes.get('/activity', isAuthenticated(), async (req, res) => {
  try {
    const settings = getSettings();
    const { days = 7, limit = 10 } = req.query;

    if (!settings.tautulli.hostname || !settings.tautulli.apiKey) {
      return res.status(400).json({
        error: 'Tautulli not configured',
        message: 'Tautulli settings are required to fetch activity statistics',
      });
    }

    const tautulli = new TautulliAPI(settings.tautulli);

    // Get various activity stats
    const [topMovies, topTV, info] = await Promise.all([
      tautulli.getHomeStats(Number(days), 'plays', 'top_movies', Number(limit)),
      tautulli.getHomeStats(Number(days), 'plays', 'top_tv', Number(limit)),
      tautulli.getInfo().catch(() => null),
    ]);

    res.status(200).json({
      activity: {
        topMovies,
        topTV,
      },
      tautulliInfo: info,
      metadata: {
        days: Number(days),
        limit: Number(limit),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get activity statistics', {
      label: 'Dashboard API',
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to get activity statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default dashboardRoutes;
