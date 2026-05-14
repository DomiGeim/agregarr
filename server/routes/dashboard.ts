import TautulliAPI from '@server/api/tautulli';
import { getRepository } from '@server/datasource';
import { CollectionMetadata } from '@server/entity/CollectionMetadata';
import { MissingItemRequest } from '@server/entity/MissingItemRequest';
import { PlaceholderItem } from '@server/entity/PlaceholderItem';
import type {
  CollectionConfig,
  PreExistingCollectionConfig,
} from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { getAppVersion } from '@server/utils/appVersion';
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

interface CollectionHealthScore {
  id: string;
  name: string;
  type: string;
  libraryName?: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  reasons: string[];
  lastSyncedAt?: string;
  needsSync?: boolean;
}

type DashboardCollectionConfig = CollectionConfig | PreExistingCollectionConfig;

interface TrendStats {
  currentWeekPlays: number;
  previousWeekPlays: number;
  delta: number;
  deltaPercent: number;
  topMovies: {
    title: string;
    ratingKey?: string;
    plays: number;
    mediaType?: string;
  }[];
  topTv: {
    title: string;
    ratingKey?: string;
    plays: number;
    mediaType?: string;
  }[];
}

const getConfigType = (config: DashboardCollectionConfig): string =>
  'type' in config ? config.type : 'pre-existing';

const getLastSyncError = (
  config: DashboardCollectionConfig
): string | undefined =>
  'lastSyncError' in config ? config.lastSyncError : undefined;

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

const getPlexImageProxyUrl = (imagePath?: string): string | undefined => {
  if (!imagePath) {
    return undefined;
  }

  let normalizedPath = imagePath;

  try {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      normalizedPath = new URL(imagePath).pathname;
    }
  } catch (error) {
    normalizedPath = imagePath;
  }

  normalizedPath = normalizedPath.split('?')[0];

  if (!normalizedPath.startsWith('/')) {
    return undefined;
  }

  return `/api/v1/plex/image?path=${encodeURIComponent(normalizedPath)}`;
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

const getAllCollectionConfigs = (
  settings: ReturnType<typeof getSettings>
): DashboardCollectionConfig[] => [
  ...(settings.plex.collectionConfigs || []),
  ...(settings.plex.preExistingCollectionConfigs || []),
];

const getDaysSince = (dateValue?: string): number | null => {
  if (!dateValue) {
    return null;
  }

  const timestamp = new Date(dateValue).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
};

const hasCollectionRatingKey = (config: DashboardCollectionConfig): boolean =>
  !!config.collectionRatingKey ||
  ('collectionRatingKeys' in config &&
    Array.isArray(config.collectionRatingKeys) &&
    config.collectionRatingKeys.length > 0);

const hasAutoHandling = (config: DashboardCollectionConfig): boolean =>
  !!(
    ('searchMissingMovies' in config && config.searchMissingMovies) ||
    ('searchMissingTV' in config && config.searchMissingTV) ||
    ('createPlaceholdersForMissing' in config &&
      config.createPlaceholdersForMissing)
  );

const getCollectionHealthScores = (
  settings: ReturnType<typeof getSettings>
): CollectionHealthScore[] => {
  const libraries = settings.plex.libraries || [];
  const libraryKeys = new Set(libraries.map((library) => library.key));

  return getAllCollectionConfigs(settings)
    .map((config) => {
      const reasons: string[] = [];
      let score = 100;
      const lastSyncError = getLastSyncError(config);
      const daysSinceSync = getDaysSince(config.lastSyncedAt);
      const visibilityEnabled =
        config.visibilityConfig?.usersHome ||
        config.visibilityConfig?.serverOwnerHome ||
        config.visibilityConfig?.libraryRecommended;

      if (lastSyncError) {
        score -= 45;
        reasons.push('Letzter Sync fehlgeschlagen');
      }

      if (config.missing) {
        score -= 35;
        reasons.push('Collection fehlt in Plex');
      }

      if (!config.libraryId || !libraryKeys.has(config.libraryId)) {
        score -= 25;
        reasons.push('Bibliothek fehlt oder ist nicht synchronisiert');
      }

      if (config.needsSync) {
        score -= 12;
        reasons.push('Aenderungen warten auf Sync');
      }

      if (
        !hasCollectionRatingKey(config) &&
        getConfigType(config) !== 'filtered_hub' &&
        !config.missing
      ) {
        score -= 12;
        reasons.push('Noch kein Plex Rating Key vorhanden');
      }

      if (!visibilityEnabled) {
        score -= 8;
        reasons.push('Keine Sichtbarkeit fuer Home/Recommended aktiv');
      }

      if (daysSinceSync !== null && daysSinceSync > 30) {
        score -= 10;
        reasons.push(`Seit ${daysSinceSync} Tagen nicht synchronisiert`);
      }

      if (config.isActive === false) {
        score -= 5;
        reasons.push('Durch Zeitregeln derzeit inaktiv');
      }

      const normalizedScore = Math.max(0, Math.min(100, score));
      const status: CollectionHealthScore['status'] =
        normalizedScore < 60
          ? 'critical'
          : normalizedScore < 85
          ? 'warning'
          : 'healthy';

      return {
        id: config.id,
        name: config.name,
        type: getConfigType(config),
        libraryName: config.libraryName,
        score: normalizedScore,
        status,
        reasons: reasons.length ? reasons : ['Keine Auffaelligkeiten'],
        lastSyncedAt: config.lastSyncedAt,
        needsSync: !!config.needsSync,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 12);
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
  const collectionConfigs = getAllCollectionConfigs(settings);
  const sourceUsage = collectionConfigs.reduce((acc, config) => {
    const type = getConfigType(config);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sources = [
    {
      id: 'media-server',
      name: settings.plex.mediaServerType === 'jellyfin' ? 'Jellyfin' : 'Plex',
      configured: !!settings.plex.ip,
      usedByCollections: collectionConfigs.length,
      status: settings.plex.ip ? 'configured' : 'missing',
    },
    {
      id: 'tautulli',
      name: 'Tautulli',
      configured: !!settings.tautulli.hostname && !!settings.tautulli.apiKey,
      usedByCollections: sourceUsage.tautulli || 0,
      status:
        settings.tautulli.hostname && settings.tautulli.apiKey
          ? 'configured'
          : 'missing',
    },
    {
      id: 'radarr',
      name: 'Radarr',
      configured: (settings.radarr || []).some(
        (server) => !!server.hostname && !!server.apiKey
      ),
      usedByCollections: collectionConfigs.filter(
        (config) =>
          ('searchMissingMovies' in config && config.searchMissingMovies) ||
          getConfigType(config) === 'radarrtag'
      ).length,
      status: (settings.radarr || []).some(
        (server) => !!server.hostname && !!server.apiKey
      )
        ? 'configured'
        : 'missing',
    },
    {
      id: 'sonarr',
      name: 'Sonarr',
      configured: (settings.sonarr || []).some(
        (server) => !!server.hostname && !!server.apiKey
      ),
      usedByCollections: collectionConfigs.filter(
        (config) =>
          ('searchMissingTV' in config && config.searchMissingTV) ||
          getConfigType(config) === 'sonarrtag'
      ).length,
      status: (settings.sonarr || []).some(
        (server) => !!server.hostname && !!server.apiKey
      )
        ? 'configured'
        : 'missing',
    },
    {
      id: 'trakt',
      name: 'Trakt',
      configured: !!settings.trakt.apiKey || !!settings.trakt.accessToken,
      usedByCollections: sourceUsage.trakt || 0,
      status:
        settings.trakt.apiKey || settings.trakt.accessToken
          ? 'configured'
          : 'missing',
    },
    {
      id: 'mdblist',
      name: 'MDBList',
      configured: !!settings.mdblist.apiKey,
      usedByCollections: sourceUsage.mdblist || 0,
      status: settings.mdblist.apiKey ? 'configured' : 'missing',
    },
    {
      id: 'tmdb',
      name: 'TMDB',
      configured: true,
      usedByCollections:
        (sourceUsage.tmdb || 0) +
        (sourceUsage.networks || 0) +
        (sourceUsage.originals || 0) +
        (sourceUsage.comingsoon || 0),
      status: 'configured',
    },
  ];

  return {
    configured: sources.filter((source) => source.configured).length,
    total: sources.length,
    sources,
  };
};

const getDashboardRecommendations = (
  settings: ReturnType<typeof getSettings>,
  collectionScores: CollectionHealthScore[]
) => {
  const collectionConfigs = settings.plex.collectionConfigs || [];
  const recommendations: {
    id: string;
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }[] = [];
  const staleScores = collectionScores.filter((score) =>
    score.reasons.some((reason) =>
      reason.includes('Tagen nicht synchronisiert')
    )
  );
  const brokenScores = collectionScores.filter(
    (score) => score.status === 'critical'
  );
  const placeholderConfigs = collectionConfigs.filter(
    (config) => config.createPlaceholdersForMissing
  );
  const autoHandlingConfigs = collectionConfigs.filter(hasAutoHandling);
  const noVisibilityConfigs = collectionConfigs.filter(
    (config) =>
      !config.visibilityConfig?.usersHome &&
      !config.visibilityConfig?.serverOwnerHome &&
      !config.visibilityConfig?.libraryRecommended
  );

  if (brokenScores.length > 0) {
    recommendations.push({
      id: 'critical-collections',
      title: 'Kritische Collections zuerst pruefen',
      message: `${brokenScores.length} Collections haben Fehler, fehlende Bibliotheken oder fehlende Plex-Zuordnung.`,
      priority: 'high',
    });
  }

  if (staleScores.length > 0) {
    recommendations.push({
      id: 'stale-sync',
      title: 'Stale Collections neu synchronisieren',
      message: `${staleScores.length} Collections wurden seit ueber 30 Tagen nicht erfolgreich synchronisiert.`,
      priority: 'medium',
    });
  }

  if (placeholderConfigs.length > 0) {
    recommendations.push({
      id: 'placeholder-preview',
      title: 'Placeholder Cleanup regelmaessig pruefen',
      message: `${placeholderConfigs.length} Collections erstellen Placeholder. Die Cleanup-Vorschau zeigt dir alte Eintraege vor dem Entfernen.`,
      priority: 'medium',
    });
  }

  if (autoHandlingConfigs.length === 0 && collectionConfigs.length > 0) {
    recommendations.push({
      id: 'auto-handling',
      title: 'Auto-Requests oder Placeholder gezielt aktivieren',
      message:
        'Keine Collection verarbeitet fehlende Medien automatisch. Fuer kuratierte Listen kann das viel Handarbeit sparen.',
      priority: 'low',
    });
  }

  if (noVisibilityConfigs.length > 0) {
    recommendations.push({
      id: 'hidden-collections',
      title: 'Unsichtbare Collections aufraeumen',
      message: `${noVisibilityConfigs.length} Collections sind weder Home noch Recommended zugeordnet.`,
      priority: 'low',
    });
  }

  return recommendations.slice(0, 6);
};

const getDashboardPreviews = async (
  settings: ReturnType<typeof getSettings>
) => {
  const collectionConfigs = settings.plex.collectionConfigs || [];
  const allConfigs = getAllCollectionConfigs(settings);
  const placeholderRepository = getRepository(PlaceholderItem);
  const missingItemRepository = getRepository(MissingItemRequest);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [placeholderCount, stalePlaceholderCount, pendingRequestCount] =
    await Promise.all([
      placeholderRepository.count().catch(() => 0),
      placeholderRepository
        .createQueryBuilder('placeholder')
        .where('placeholder.createdAt < :date', { date: thirtyDaysAgo })
        .getCount()
        .catch(() => 0),
      missingItemRepository
        .createQueryBuilder('missing')
        .where('missing.requestStatus IN (:...statuses)', {
          statuses: ['pending', 'processing', 'failed'],
        })
        .getCount()
        .catch(() => 0),
    ]);

  const needsSync = allConfigs.filter((config) => config.needsSync);
  const withErrors = allConfigs.filter((config) => getLastSyncError(config));
  const autoRequestConfigs = collectionConfigs.filter(hasAutoHandling);

  return {
    syncDryRun: {
      collectionsToSync: needsSync.length || collectionConfigs.length,
      changedCollections: needsSync.slice(0, 8).map((config) => ({
        id: config.id,
        name: config.name,
        type: getConfigType(config),
        libraryName: config.libraryName,
      })),
      collectionsWithErrors: withErrors.length,
      autoRequestEnabled: autoRequestConfigs.length,
      estimatedActions: [
        `${needsSync.length || collectionConfigs.length} Collections pruefen`,
        `${autoRequestConfigs.length} Collections koennen fehlende Medien verarbeiten`,
        `${withErrors.length} bekannte Sync-Fehler wuerden erneut versucht`,
      ],
    },
    cleanupPreview: {
      placeholderCount,
      stalePlaceholderCount,
      pendingRequestCount,
      notes: [
        `${stalePlaceholderCount} Placeholder sind aelter als 30 Tage`,
        `${pendingRequestCount} Missing-Item Requests sind offen, in Bearbeitung oder fehlgeschlagen`,
      ],
    },
  };
};

const getAdvancedIntelligence = async (
  settings: ReturnType<typeof getSettings>,
  collectionScores: CollectionHealthScore[],
  sourceStatus: ReturnType<typeof getSourceStatus>,
  trends: TrendStats | null
) => {
  const allConfigs = getAllCollectionConfigs(settings);
  const placeholderRepository = getRepository(PlaceholderItem);
  const missingItemRepository = getRepository(MissingItemRequest);
  const metadataRepository = getRepository(CollectionMetadata);
  const now = Date.now();

  const [recentPlaceholders, recentRequests, recentMetadata] =
    await Promise.all([
      placeholderRepository
        .find({ order: { updatedAt: 'DESC' }, take: 8 })
        .catch(() => [] as PlaceholderItem[]),
      missingItemRepository
        .find({ order: { updatedAt: 'DESC' }, take: 8 })
        .catch(() => [] as MissingItemRequest[]),
      metadataRepository
        .find({ order: { updatedAt: 'DESC' }, take: 8 })
        .catch(() => [] as CollectionMetadata[]),
    ]);

  const staleCollections = collectionScores.filter((score) =>
    score.reasons.some((reason) =>
      reason.includes('Tagen nicht synchronisiert')
    )
  );
  const criticalCollections = collectionScores.filter(
    (score) => score.status === 'critical'
  );
  const hiddenCollections = allConfigs.filter(
    (config) =>
      !config.visibilityConfig?.usersHome &&
      !config.visibilityConfig?.serverOwnerHome &&
      !config.visibilityConfig?.libraryRecommended
  );
  const actionCenter = [
    ...criticalCollections.slice(0, 3).map((collection) => ({
      id: `fix-${collection.id}`,
      title: `${collection.name} pruefen`,
      message: collection.reasons[0],
      priority: 'high' as const,
      href: '/allcollections',
      actionLabel: 'Collection oeffnen',
    })),
    ...(settings.tautulli.hostname && settings.tautulli.apiKey
      ? []
      : [
          {
            id: 'configure-tautulli',
            title: 'Tautulli konfigurieren',
            message:
              'Aktiviere Tautulli, damit Trends, Heat Scores und Collection Views genauer werden.',
            priority: 'medium' as const,
            href: '/settings/sources',
            actionLabel: 'Quellen oeffnen',
          },
        ]),
    ...(hiddenCollections.length
      ? [
          {
            id: 'hidden-collections',
            title: 'Unsichtbare Collections pruefen',
            message: `${hiddenCollections.length} Collections sind aktuell in keinem Hub sichtbar.`,
            priority: 'low' as const,
            href: '/allcollections',
            actionLabel: 'Collections oeffnen',
          },
        ]
      : []),
    ...(staleCollections.length
      ? [
          {
            id: 'stale-collections',
            title: 'Stale Collections synchronisieren',
            message: `${staleCollections.length} Collections wurden lange nicht erfolgreich synchronisiert.`,
            priority: 'medium' as const,
            href: '/allcollections',
            actionLabel: 'Sync pruefen',
          },
        ]
      : []),
  ].slice(0, 6);

  const collectionTimeline = [
    ...recentRequests.map((request) => ({
      id: `request-${request.id}`,
      type: 'request',
      title: request.title,
      message: `${request.collectionName} -> ${request.requestStatus}`,
      at: request.updatedAt?.toISOString?.() || request.createdAt.toISOString(),
    })),
    ...recentPlaceholders.map((placeholder) => ({
      id: `placeholder-${placeholder.id}`,
      type: 'placeholder',
      title: placeholder.title,
      message: `${placeholder.source} placeholder in ${placeholder.mediaType}`,
      at: placeholder.updatedAt.toISOString(),
    })),
    ...recentMetadata.map((metadata) => ({
      id: `metadata-${metadata.plexCollectionRatingKey}`,
      type: 'metadata',
      title: metadata.collectionConfigId || metadata.plexCollectionRatingKey,
      message: 'Poster/Wallpaper/Theme metadata aktualisiert',
      at: metadata.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);

  const heatItems = [
    ...(trends?.topMovies || []).map((item) => ({
      ...item,
      mediaType: 'movie',
    })),
    ...(trends?.topTv || []).map((item) => ({
      ...item,
      mediaType: 'tv',
    })),
  ]
    .map((item) => ({
      title: item.title,
      mediaType: item.mediaType,
      plays: item.plays,
      heatScore: Math.min(
        100,
        Math.round(item.plays * 10 + Math.max(0, trends?.deltaPercent || 0) / 2)
      ),
    }))
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 8);

  const autoSnoozeCandidates = collectionScores
    .filter(
      (score) =>
        score.score < 75 ||
        score.reasons.some(
          (reason) =>
            reason.includes('nicht synchronisiert') ||
            reason.includes('Keine Sichtbarkeit')
        )
    )
    .slice(0, 8)
    .map((score) => ({
      id: score.id,
      name: score.name,
      score: score.score,
      reason: score.reasons[0],
      recommendation:
        score.score < 60
          ? 'Aus Home/Recommended entfernen, bis der Fehler behoben ist'
          : 'Beobachten oder temporaer ausblenden, wenn sie wenig Wert liefert',
    }));

  const sourceReliability = sourceStatus.sources.map((source) => {
    const missingPenalty = source.configured ? 0 : 45;
    const unusedPenalty = source.usedByCollections === 0 ? 10 : 0;
    const score = Math.max(0, 100 - missingPenalty - unusedPenalty);

    return {
      id: source.id,
      name: source.name,
      score,
      status: score >= 90 ? 'ok' : score >= 60 ? 'watch' : 'attention',
      message: source.configured
        ? `${source.usedByCollections || 0} Collections nutzen diese Quelle`
        : 'Quelle ist nicht konfiguriert',
    };
  });

  const placeholderLifecycle = {
    total: recentPlaceholders.length,
    items: recentPlaceholders.map((placeholder) => {
      const ageDays = Math.max(
        0,
        Math.floor((now - placeholder.createdAt.getTime()) / 86400000)
      );

      return {
        id: placeholder.id,
        title: placeholder.title,
        mediaType: placeholder.mediaType,
        source: placeholder.source,
        configId: placeholder.configId,
        ageDays,
        hasPlexRatingKey: !!placeholder.plexRatingKey,
      };
    }),
  };

  const explainers = [
    {
      id: 'collection-views',
      label: 'Collection Views',
      explanation:
        'Summe der Tautulli Plays fuer Collections mit bekanntem Plex Rating Key im aktuellen 7-Tage-Fenster.',
      source: 'Tautulli get_item_watch_time_stats',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'health-score',
      label: 'Health Score',
      explanation:
        'Startet bei 100 und zieht Punkte fuer Sync-Fehler, fehlende Bibliotheken, fehlende Rating Keys, ausstehende Syncs und lange Inaktivitaet ab.',
      source: 'Agregarr Settings + Sync Status',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sync-dry-run',
      label: 'Sync Dry Run',
      explanation:
        'Zaehlt Collections mit ausstehenden Aenderungen, bekannten Fehlern und aktivem Missing-Media-Handling, ohne Daten zu veraendern.',
      source: 'Agregarr Settings + Missing Item Tracking',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'heat-score',
      label: 'Tautulli Heat Score',
      explanation:
        'Kombiniert aktuelle Plays mit dem Trend zur Vorwoche. Der Wert ist ein Dashboard-Signal, kein gespeicherter Plex-Wert.',
      source: 'Tautulli Home Stats',
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    actionCenter,
    collectionTimeline,
    changelog: {
      version: getAppVersion(),
      highlights: [
        'Action Center fuer direkte naechste Schritte',
        'Collection Timeline aus Requests, Placeholdern und Metadata-Updates',
        'Heat Scores und Source Reliability fuer bessere Priorisierung',
        'Placeholder Lifecycle View und Erklaerungen fuer Dashboard-Zahlen',
      ],
    },
    heatScores: heatItems,
    autoSnoozeCandidates,
    sourceReliability,
    placeholderLifecycle,
    explainers,
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
    const collectionHealthScores = getCollectionHealthScores(settings);
    const cacheKey = `stats:${collectionRatingKeys.join(',')}`;
    const cachedDashboardData = getCachedDashboardData(cacheKey);

    if (cachedDashboardData) {
      return res.status(200).json(cachedDashboardData);
    }

    let tautulliStats = null;
    let collectionStatsData = null;
    let weeklyStats = null;
    let trendStats: TrendStats | null = null;

    // Get Tautulli stats if configured
    if (settings.tautulli.hostname && settings.tautulli.apiKey) {
      try {
        const tautulli = new TautulliAPI(settings.tautulli);

        // Get collection stats and weekly activity stats
        const [
          collectionStats,
          weeklyMovies,
          weeklyTV,
          previousMovies,
          previousTV,
        ] = await withTimeout(
          Promise.all([
            tautulli.getTopCollections(50, 'plays', 7, collectionRatingKeys, {
              includeMetadata: false,
              includeUserStats: false,
              concurrency: 6,
            }),
            tautulli.getHomeStats(7, 'plays', 'top_movies', 10),
            tautulli.getHomeStats(7, 'plays', 'top_tv', 10),
            tautulli.getHomeStats(14, 'plays', 'top_movies', 10),
            tautulli.getHomeStats(14, 'plays', 'top_tv', 10),
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
        const previousMoviePlays = previousMovies.reduce(
          (sum, item) => sum + getPlayCount(item),
          0
        );
        const previousTvPlays = previousTV.reduce(
          (sum, item) => sum + getPlayCount(item),
          0
        );
        const previousWindowPlays = Math.max(
          0,
          previousMoviePlays + previousTvPlays - totalWeeklyPlays
        );
        const playDelta = totalWeeklyPlays - previousWindowPlays;
        const playDeltaPercent =
          previousWindowPlays > 0
            ? Math.round((playDelta / previousWindowPlays) * 100)
            : totalWeeklyPlays > 0
            ? 100
            : 0;

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

        trendStats = {
          currentWeekPlays: totalWeeklyPlays,
          previousWeekPlays: previousWindowPlays,
          delta: playDelta,
          deltaPercent: playDeltaPercent,
          topMovies: weeklyMovies.slice(0, 5).map((item) => ({
            title: item.title,
            ratingKey: item.rating_key,
            plays: getPlayCount(item),
            mediaType: item.media_type,
          })),
          topTv: weeklyTV.slice(0, 5).map((item) => ({
            title: item.grandparent_title || item.title,
            ratingKey: item.grandparent_rating_key || item.rating_key,
            plays: getPlayCount(item),
            mediaType: item.media_type,
          })),
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

    const sourceStatus = getSourceStatus(settings);
    const advancedIntelligence = await getAdvancedIntelligence(
      settings,
      collectionHealthScores,
      sourceStatus,
      trendStats
    );

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
      collectionHealthScores,
      recommendations: getDashboardRecommendations(
        settings,
        collectionHealthScores
      ),
      previews: await getDashboardPreviews(settings),
      trends: trendStats,
      sourceStatus,
      intelligence: advancedIntelligence,
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
        const imagePath =
          item.media_type === 'episode'
            ? item.grandparent_thumb || item.parent_thumb || item.thumb
            : item.media_type === 'season'
            ? item.parent_thumb || item.thumb
            : item.thumb;

        return {
          id: Number(item.rating_key) || index,
          tmdbId: 0,
          mediaType: requestedMediaType,
          title:
            item.media_type === 'episode'
              ? item.grandparent_title || item.full_title || item.title
              : item.title,
          posterPath: undefined,
          posterUrl: getPlexImageProxyUrl(imagePath),
          thumb: imagePath,
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
    const collectionsWithImages = collections.map((collection) => ({
      ...collection,
      posterUrl: getPlexImageProxyUrl(collection.thumb),
    }));

    const collectionData = {
      collections: collectionsWithImages,
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
