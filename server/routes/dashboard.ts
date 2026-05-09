import TautulliAPI from '@server/api/tautulli';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';

const dashboardRoutes = Router();
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const TAUTULLI_DASHBOARD_TIMEOUT_MS = 60000;

type HealthSeverity = 'error' | 'warning' | 'info';

interface HealthIssue {
  severity: HealthSeverity;
  area: string;
  message: string;
}

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

const getCollectionMediaTypeByRatingKey = (
  settings: ReturnType<typeof getSettings>
) => {
  const libraryTypes = new Map(
    (settings.plex.libraries || []).map((library) => [
      library.key,
      library.type,
    ])
  );
  const mediaTypeByRatingKey = new Map<string, 'movie' | 'show'>();
  const collectionConfigs = [
    ...(settings.plex.collectionConfigs || []),
    ...(settings.plex.preExistingCollectionConfigs || []),
  ];

  for (const config of collectionConfigs) {
    const mediaTypeValue =
      'mediaType' in config && config.mediaType
        ? config.mediaType
        : libraryTypes.get(config.libraryId);
    const mediaType = mediaTypeValue === 'tv' ? 'show' : mediaTypeValue;

    if (!mediaType) {
      continue;
    }

    if (config.collectionRatingKey) {
      mediaTypeByRatingKey.set(config.collectionRatingKey, mediaType);
    }

    if ('collectionRatingKeys' in config && config.collectionRatingKeys) {
      for (const ratingKey of config.collectionRatingKeys) {
        mediaTypeByRatingKey.set(ratingKey, mediaType);
      }
    }
  }

  return mediaTypeByRatingKey;
};

const getCollectionHealth = (settings: ReturnType<typeof getSettings>) => {
  const issues: HealthIssue[] = [];
  const collectionConfigs = settings.plex.collectionConfigs || [];
  const preExistingConfigs = settings.plex.preExistingCollectionConfigs || [];
  const allConfigs = [...collectionConfigs, ...preExistingConfigs];
  const libraries = settings.plex.libraries || [];
  const libraryKeys = new Set(libraries.map((library) => library.key));
  const nameCounts = new Map<string, number>();

  if (!settings.plex.ip) {
    issues.push({
      severity: 'error',
      area: 'media-server',
      message: 'Kein aktiver Medienserver ist konfiguriert.',
    });
  }

  if (libraries.length === 0) {
    issues.push({
      severity: 'warning',
      area: 'libraries',
      message:
        'Fuer den aktiven Medienserver sind keine Bibliotheken synchronisiert.',
    });
  }

  for (const config of allConfigs) {
    const name = config.name?.trim() || 'Unnamed collection';
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);

    if (!config.libraryId) {
      issues.push({
        severity: 'warning',
        area: 'collections',
        message: `${name} hat keine Zielbibliothek ausgewaehlt.`,
      });
    } else if (!libraryKeys.has(config.libraryId)) {
      issues.push({
        severity: 'error',
        area: 'collections',
        message: `${name} nutzt eine Bibliothek, die nicht mehr synchronisiert ist.`,
      });
    }

    const syncState = config as {
      lastSyncError?: string;
      needsSync?: boolean;
    };

    if (syncState.lastSyncError) {
      issues.push({
        severity: 'error',
        area: 'sync',
        message: `${name} ist beim letzten Sync fehlgeschlagen: ${syncState.lastSyncError}`,
      });
    } else if (syncState.needsSync) {
      issues.push({
        severity: 'info',
        area: 'sync',
        message: `${name} hat ausstehende Aenderungen und benoetigt einen Sync.`,
      });
    }
  }

  for (const [name, count] of nameCounts.entries()) {
    if (count > 1) {
      issues.push({
        severity: 'warning',
        area: 'collections',
        message: `${count} Sammlungen verwenden den Namen "${name}".`,
      });
    }
  }

  if (settings.main.globalSyncError) {
    issues.push({
      severity: 'error',
      area: 'sync',
      message: `Letzter globaler Sync fehlgeschlagen: ${settings.main.globalSyncError}`,
    });
  }

  const totals = {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };

  return {
    status:
      totals.errors > 0 ? 'error' : totals.warnings > 0 ? 'warning' : 'ok',
    totals,
    issues: issues.slice(0, 10),
    checkedAt: new Date().toISOString(),
  };
};

const getSourceStatus = (settings: ReturnType<typeof getSettings>) => {
  const sources = [
    {
      id: 'media-server',
      name: settings.plex.mediaServerType === 'jellyfin' ? 'Jellyfin' : 'Plex',
      configured: !!settings.plex.ip,
    },
    {
      id: 'tautulli',
      name: 'Tautulli',
      configured: !!settings.tautulli.hostname && !!settings.tautulli.apiKey,
    },
    {
      id: 'radarr',
      name: 'Radarr',
      configured: (settings.radarr || []).some(
        (server) => !!server.hostname && !!server.apiKey
      ),
    },
    {
      id: 'sonarr',
      name: 'Sonarr',
      configured: (settings.sonarr || []).some(
        (server) => !!server.hostname && !!server.apiKey
      ),
    },
    {
      id: 'trakt',
      name: 'Trakt',
      configured: !!settings.trakt.apiKey || !!settings.trakt.accessToken,
    },
    {
      id: 'mdblist',
      name: 'MDBList',
      configured: !!settings.mdblist.apiKey,
    },
  ];

  return {
    configured: sources.filter((source) => source.configured).length,
    total: sources.length,
    sources,
  };
};

/**
 * GET /api/v1/dashboard/stats
 * Get dashboard statistics including collection stats, user activity, etc.
 */
dashboardRoutes.get('/stats', isAuthenticated(), async (req, res) => {
  try {
    const settings = getSettings();
    const collectionRatingKeys = getCollectionRatingKeys(settings);
    const collectionMediaTypes = getCollectionMediaTypeByRatingKey(settings);
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
            tautulli.getTopCollections(50, 'plays', 7, collectionRatingKeys, {
              includeMetadata: false,
              includeUserStats: false,
              concurrency: 6,
            }),
            tautulli.getHomeStats(7, 'plays', 'top_movies', 10),
            tautulli.getHomeStats(7, 'plays', 'top_tv', 10),
          ]),
          TAUTULLI_DASHBOARD_TIMEOUT_MS,
          'Tautulli dashboard request timed out'
        );

        // Calculate weekly plays from server totals
        let moviePlaysCount = 0;
        let tvPlaysCount = 0;
        const getPlayCount = (item: {
          total_plays?: number;
          play_count?: number;
          plays?: number;
        }) => Number(item.total_plays ?? item.play_count ?? item.plays ?? 0);

        weeklyMovies.forEach((item) => {
          moviePlaysCount += getPlayCount(item);
        });

        weeklyTV.forEach((item) => {
          tvPlaysCount += getPlayCount(item);
        });

        const totalWeeklyPlays = moviePlaysCount + tvPlaysCount;

        // Calculate collection-specific plays
        let collectionTotalPlays = 0;
        let collectionMoviePlays = 0;
        let collectionTvPlays = 0;

        collectionStats.forEach((collection) => {
          collectionTotalPlays += collection.total_plays;
          const configuredMediaType = collectionMediaTypes.get(
            collection.rating_key
          );

          if (
            configuredMediaType === 'movie' ||
            collection.media_type === 'movie' ||
            collection.title.toLowerCase().includes('movie') ||
            collection.title.toLowerCase().includes('film')
          ) {
            collectionMoviePlays += collection.total_plays;
          } else if (
            configuredMediaType === 'show' ||
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
          configured: true,
          statsAvailable:
            weeklyMovies.length > 0 ||
            weeklyTV.length > 0 ||
            collectionStats.length > 0,
          weeklyActivity: weeklyStats,
        };
      } catch (error) {
        logger.error('Failed to fetch Tautulli stats for dashboard', {
          label: 'Dashboard API',
          error: error.message,
        });
        tautulliStats = {
          isConnected: false,
          configured: true,
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
      health: getCollectionHealth(settings),
      sourceStatus: getSourceStatus(settings),
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

dashboardRoutes.get(
  '/tautulli-recently-added',
  isAuthenticated(),
  async (req, res) => {
    try {
      const settings = getSettings();
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const requestedMediaType = req.query.mediaType === 'tv' ? 'tv' : 'movie';
      const tautulliMediaType = requestedMediaType === 'tv' ? 'show' : 'movie';

      if (!settings.tautulli.hostname || !settings.tautulli.apiKey) {
        return res.status(200).json({
          results: [],
          total: 0,
          limit,
          offset,
          configured: false,
        });
      }

      const tautulli = new TautulliAPI(settings.tautulli);
      const items = (
        await tautulli.getRecentlyAdded(
          limit + offset,
          0,
          undefined,
          tautulliMediaType
        )
      )
        .filter((item) =>
          requestedMediaType === 'movie'
            ? item.media_type === 'movie'
            : item.media_type === 'show' ||
              item.media_type === 'season' ||
              item.media_type === 'episode'
        )
        .sort((a, b) => Number(b.added_at || 0) - Number(a.added_at || 0))
        .slice(offset, offset + limit);

      const results = items.map((item, index) => {
        const numericAddedAt = Number(item.added_at);
        const createdAt = !Number.isNaN(numericAddedAt)
          ? new Date(numericAddedAt * 1000).toISOString()
          : new Date().toISOString();

        return {
          id: Number(item.rating_key) || index,
          tmdbId: 0,
          mediaType: requestedMediaType,
          title:
            item.media_type === 'episode'
              ? item.grandparent_title || item.full_title || item.title
              : item.title,
          posterPath: undefined,
          posterUrl: undefined,
          year: item.year ? Number(item.year) : undefined,
          collectionName: item.section_name || 'Tautulli',
          collectionSource: 'Tautulli',
          requestService: 'Tautulli',
          requestMethod: 'auto',
          requestStatus: 'available',
          createdAt,
          requestedAt: createdAt,
        };
      });

      return res.status(200).json({
        results,
        total: results.length,
        limit,
        offset,
        configured: true,
      });
    } catch (error) {
      logger.error('Failed to retrieve Tautulli recently added items', {
        label: 'Dashboard API',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(200).json({
        results: [],
        total: 0,
        limit: parseInt(req.query.limit as string) || 10,
        offset: parseInt(req.query.offset as string) || 0,
        configured: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

dashboardRoutes.get('/health', isAuthenticated(), (_req, res) => {
  const settings = getSettings();
  return res.status(200).json(getCollectionHealth(settings));
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
