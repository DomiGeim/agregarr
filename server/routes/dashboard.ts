import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TautulliAPI from '@server/api/tautulli';
import { getRepository } from '@server/datasource';
import { CollectionMetadata } from '@server/entity/CollectionMetadata';
import { MissingItemRequest } from '@server/entity/MissingItemRequest';
import { PlaceholderItem } from '@server/entity/PlaceholderItem';
import collectionsSync from '@server/lib/collectionsSync';
import type {
  CollectionConfig,
  PreExistingCollectionConfig,
} from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { appDataPath } from '@server/utils/appDataVolume';
import { getAppVersion } from '@server/utils/appVersion';
import axios from 'axios';
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';

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

interface SourceTestResult {
  id: string;
  name: string;
  configured: boolean;
  ok: boolean;
  latencyMs: number;
  testedAt: string;
  message: string;
  error?: string;
}

interface DashboardEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  at: string;
  metadata?: Record<string, unknown>;
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

const sourceTestResults = new Map<string, SourceTestResult>();

const dashboardEventsPath = (): string =>
  path.join(appDataPath(), 'dashboard-events.jsonl');

const readDashboardEvents = async (limit = 50): Promise<DashboardEvent[]> => {
  try {
    const file = await fs.readFile(dashboardEventsPath(), 'utf-8');

    return file
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line) as DashboardEvent)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  } catch (error) {
    return [];
  }
};

const appendDashboardEvent = async (
  event: Omit<DashboardEvent, 'id' | 'at'>
): Promise<void> => {
  try {
    const at = new Date().toISOString();
    const fullEvent: DashboardEvent = {
      id: `${event.type}-${Date.now()}`,
      at,
      ...event,
    };

    await fs.mkdir(appDataPath(), { recursive: true });
    await fs.appendFile(
      dashboardEventsPath(),
      `${JSON.stringify(fullEvent)}\n`,
      'utf-8'
    );
  } catch (error) {
    logger.warn('Failed to write dashboard event', {
      label: 'Dashboard API',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const sanitizeSettings = (settings: unknown): unknown =>
  JSON.parse(
    JSON.stringify(settings, (key, value) => {
      if (/apikey|apiKey|token|password|secret/i.test(key)) {
        return value ? '[redacted]' : value;
      }

      return value;
    })
  );

const validateSettingsBackup = (
  backup: unknown
): { valid: boolean; missingKeys: string[]; collectionCount: number } => {
  const requiredKeys = ['main', 'plex', 'tautulli', 'radarr', 'sonarr'];

  if (!backup || typeof backup !== 'object') {
    return {
      valid: false,
      missingKeys: requiredKeys,
      collectionCount: 0,
    };
  }

  const data = backup as Record<string, unknown>;
  const missingKeys = requiredKeys.filter((key) => !(key in data));
  const plex = data.plex as
    | {
        collectionConfigs?: unknown[];
        preExistingCollectionConfigs?: unknown[];
      }
    | undefined;

  return {
    valid: missingKeys.length === 0,
    missingKeys,
    collectionCount:
      (plex?.collectionConfigs?.length || 0) +
      (plex?.preExistingCollectionConfigs?.length || 0),
  };
};

const buildSettingsRestoreDiff = (
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
) => {
  const sections = ['main', 'plex', 'tautulli', 'radarr', 'sonarr', 'jobs'];

  return sections
    .map((section) => {
      const currentSection = current[section];
      const incomingSection = incoming[section];
      const currentJson = JSON.stringify(currentSection ?? null);
      const incomingJson = JSON.stringify(incomingSection ?? null);

      return {
        section,
        changed: currentJson !== incomingJson,
        currentSize: currentJson.length,
        incomingSize: incomingJson.length,
      };
    })
    .filter((section) => section.changed);
};

const getProblemDetails = (
  settings: ReturnType<typeof getSettings>,
  collectionScores: CollectionHealthScore[],
  sourceStatus: ReturnType<typeof getSourceStatus>
) => {
  const sourceProblems = sourceStatus.sources
    .filter((source) => !source.configured)
    .map((source) => ({
      id: `source-${source.id}`,
      area: 'source',
      title: `${source.name} nicht konfiguriert`,
      message:
        'Diese Quelle ist in den Settings nicht vollstaendig hinterlegt.',
      severity: 'warning' as const,
      action: 'Settings pruefen',
      href: '/settings/sources',
    }));
  const collectionProblems = collectionScores
    .filter((score) => score.status !== 'healthy')
    .slice(0, 8)
    .map((score) => ({
      id: `collection-${score.id}`,
      area: 'collection',
      title: score.name,
      message: score.reasons.join(', '),
      severity:
        score.status === 'critical' ? ('error' as const) : ('warning' as const),
      action: 'Collection pruefen',
      href: `/api/v1/dashboard/collection-diff/${score.id}`,
    }));

  if (settings.main.globalSyncError) {
    collectionProblems.unshift({
      id: 'global-sync-error',
      area: 'sync',
      title: 'Globaler Sync-Fehler',
      message: settings.main.globalSyncError,
      severity: 'error',
      action: 'Diagnose herunterladen',
      href: '/api/v1/dashboard/diagnostics',
    });
  }

  return [...sourceProblems, ...collectionProblems].slice(0, 12);
};

const getRepairCandidates = (
  settings: ReturnType<typeof getSettings>,
  collectionScores: CollectionHealthScore[]
) => {
  const allConfigs = getAllCollectionConfigs(settings);
  const duplicateNames = new Set<string>();
  const seenNames = new Set<string>();

  allConfigs.forEach((config) => {
    const name = config.name.trim().toLowerCase();

    if (seenNames.has(name)) {
      duplicateNames.add(name);
    }

    seenNames.add(name);
  });

  return [
    ...allConfigs
      .filter(
        (config) =>
          !hasCollectionRatingKey(config) &&
          getConfigType(config) !== 'filtered_hub' &&
          !config.missing
      )
      .slice(0, 8)
      .map((config) => ({
        id: `rating-key-${config.id}`,
        configId: config.id,
        title: config.name,
        type: 'missing-rating-key',
        severity: 'attention' as const,
        message:
          'Plex Rating Key fehlt. Tautulli und Collection-Statistiken koennen dadurch ungenau sein.',
        href: `/api/v1/dashboard/collection-diff/${config.id}`,
      })),
    ...allConfigs
      .filter((config) => duplicateNames.has(config.name.trim().toLowerCase()))
      .slice(0, 6)
      .map((config) => ({
        id: `duplicate-${config.id}`,
        configId: config.id,
        title: config.name,
        type: 'duplicate-name',
        severity: 'watch' as const,
        message:
          'Der Collection-Name kommt mehrfach vor und kann Auswertungen erschweren.',
        href: '/allcollections',
      })),
    ...collectionScores
      .filter((score) => score.score < 70)
      .slice(0, 6)
      .map((score) => ({
        id: `health-${score.id}`,
        configId: score.id,
        title: score.name,
        type: 'low-health',
        severity:
          score.status === 'critical'
            ? ('attention' as const)
            : ('watch' as const),
        message: score.reasons[0],
        href: `/api/v1/dashboard/collection-diff/${score.id}`,
      })),
  ].slice(0, 14);
};

const getTautulliDataQuality = (
  settings: ReturnType<typeof getSettings>,
  collectionStats: {
    rating_key?: string;
    title?: string;
    total_plays?: number;
  }[]
) => {
  const tautulliKeys = new Set(
    collectionStats.map((item) => item.rating_key).filter(Boolean)
  );
  const allConfigs = getAllCollectionConfigs(settings);
  const missingRatingKeys = allConfigs
    .filter((config) => !hasCollectionRatingKey(config))
    .map((config) => config.name)
    .slice(0, 10);
  const noTautulliMatches = allConfigs
    .filter(
      (config) =>
        config.collectionRatingKey &&
        !tautulliKeys.has(config.collectionRatingKey)
    )
    .map((config) => config.name)
    .slice(0, 10);

  return {
    configuredCollections: allConfigs.length,
    tautulliMatchedCollections: tautulliKeys.size,
    missingRatingKeyCount: missingRatingKeys.length,
    noTautulliMatchCount: noTautulliMatches.length,
    missingRatingKeys,
    noTautulliMatches,
    artworkCache: {
      enabled: true,
      strategy:
        'Plex image proxy URLs are reused by the dashboard to reduce direct Tautulli artwork calls.',
      candidateCount: collectionStats.filter((item) => item.rating_key).length,
    },
  };
};

const getTautulliMappingDebugger = (
  settings: ReturnType<typeof getSettings>,
  collectionStats: {
    rating_key?: string;
    title?: string;
    total_plays?: number;
  }[]
) => {
  const tautulliByKey = new Map(
    collectionStats
      .filter((item) => item.rating_key)
      .map((item) => [item.rating_key, item])
  );

  return getAllCollectionConfigs(settings)
    .slice(0, 50)
    .map((config) => {
      const tautulliItem = config.collectionRatingKey
        ? tautulliByKey.get(config.collectionRatingKey)
        : undefined;

      return {
        id: config.id,
        name: config.name,
        type: getConfigType(config),
        plexRatingKey: config.collectionRatingKey,
        mapped: !!tautulliItem,
        tautulliTitle: tautulliItem?.title,
        plays: tautulliItem?.total_plays || 0,
        reason: !config.collectionRatingKey
          ? 'missing-rating-key'
          : tautulliItem
          ? 'mapped'
          : 'not-returned-by-tautulli',
      };
    });
};

const getSettingsConsistency = (
  settings: ReturnType<typeof getSettings>,
  collectionScores: CollectionHealthScore[]
) => {
  const issues: {
    id: string;
    severity: 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }[] = [];

  if (settings.plex.mediaServerType === 'jellyfin' && settings.plex.machineId) {
    issues.push({
      id: 'jellyfin-plex-machine-id',
      severity: 'warning',
      title: 'Jellyfin mit Plex Machine ID',
      message:
        'Jellyfin ist aktiv, aber eine Plex Machine ID ist gesetzt. Das kann alte Plex-Reste anzeigen.',
    });
  }

  if (
    settings.tautulli.hostname &&
    settings.tautulli.apiKey &&
    settings.plex.mediaServerType === 'jellyfin'
  ) {
    issues.push({
      id: 'tautulli-jellyfin',
      severity: 'warning',
      title: 'Tautulli mit Jellyfin',
      message:
        'Tautulli ist fuer Plex gedacht. Bei aktivem Jellyfin koennen Tautulli-Werte leer bleiben.',
    });
  }

  if (
    (settings.radarr || []).length > 0 &&
    !(settings.radarr || []).some((server) => server.activeDirectory)
  ) {
    issues.push({
      id: 'radarr-root-folder',
      severity: 'warning',
      title: 'Radarr Root Folder fehlt',
      message:
        'Mindestens ein Radarr-Server ist vorhanden, aber kein aktiver Root Folder gesetzt.',
    });
  }

  if (
    (settings.sonarr || []).length > 0 &&
    !(settings.sonarr || []).some((server) => server.activeDirectory)
  ) {
    issues.push({
      id: 'sonarr-root-folder',
      severity: 'warning',
      title: 'Sonarr Root Folder fehlt',
      message:
        'Mindestens ein Sonarr-Server ist vorhanden, aber kein aktiver Root Folder gesetzt.',
    });
  }

  const missingLibraryCount = collectionScores.filter((score) =>
    score.reasons.some((reason) => reason.includes('Bibliothek fehlt'))
  ).length;

  if (missingLibraryCount > 0) {
    issues.push({
      id: 'missing-libraries',
      severity: 'error',
      title: 'Collections mit fehlender Bibliothek',
      message: `${missingLibraryCount} Collections verweisen auf nicht synchronisierte Bibliotheken.`,
    });
  }

  return issues;
};

const getDetailedSyncDryRun = async (
  settings: ReturnType<typeof getSettings>
) => {
  const missingItemRepository = getRepository(MissingItemRequest);
  const placeholderRepository = getRepository(PlaceholderItem);
  const allConfigs = getAllCollectionConfigs(settings);
  const [pendingItems, placeholders] = await Promise.all([
    missingItemRepository
      .createQueryBuilder('missing')
      .where('missing.requestStatus IN (:...statuses)', {
        statuses: ['pending', 'processing', 'failed'],
      })
      .getMany()
      .catch(() => [] as MissingItemRequest[]),
    placeholderRepository.find().catch(() => [] as PlaceholderItem[]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    wouldCheckCollections:
      allConfigs.filter((config) => config.needsSync).length ||
      allConfigs.length,
    wouldRetryErrors: allConfigs.filter((config) => getLastSyncError(config))
      .length,
    wouldProcessMissingItems: pendingItems.length,
    wouldRevisitPlaceholders: placeholders.length,
    plannedChanges: allConfigs
      .filter((config) => config.needsSync || getLastSyncError(config))
      .slice(0, 20)
      .map((config) => ({
        id: config.id,
        name: config.name,
        type: getConfigType(config),
        reason: getLastSyncError(config) || 'Aenderungen warten auf Sync',
        href: `/api/v1/dashboard/collection-diff/${config.id}`,
      })),
  };
};

const getWhyExplanations = (
  settings: ReturnType<typeof getSettings>,
  trends: TrendStats | null,
  tautulliDataQuality: ReturnType<typeof getTautulliDataQuality>
) => [
  {
    id: 'zero-collection-views',
    label: 'Warum 0 Collection Views?',
    explanation:
      tautulliDataQuality.missingRatingKeyCount > 0
        ? 'Ein Teil der Collections hat keinen Plex Rating Key. Tautulli kann diese Collections nicht eindeutig zuordnen.'
        : trends
        ? 'Tautulli hat Daten geliefert, aber im aktuellen Zeitraum keine Collection Plays fuer gemappte Collections gefunden.'
        : 'Tautulli hat keine verwertbaren Trenddaten geliefert oder ist nicht erreichbar.',
    source: 'Tautulli Mapping + Dashboard Trends',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'zero-recently-added',
    label: 'Warum keine Recently Added Items?',
    explanation:
      settings.tautulli.hostname && settings.tautulli.apiKey
        ? 'Tautulli ist konfiguriert. Wenn hier nichts erscheint, pruefe Media Type, Tautulli API-Zugriff und ob Tautulli neue Items fuer diesen Zeitraum liefert.'
        : 'Tautulli ist nicht vollstaendig konfiguriert.',
    source: 'Tautulli Recently Added',
    updatedAt: new Date().toISOString(),
  },
];

const getSourceTestHistory = (events: DashboardEvent[]) => {
  const tests = events.filter((event) => event.type === 'source-test');
  const failures = tests.filter((event) => event.metadata?.ok === false).length;
  const latencies = tests
    .map((event) => Number(event.metadata?.latencyMs || 0))
    .filter((latency) => latency > 0);

  return {
    total: tests.length,
    failures,
    successRate:
      tests.length > 0
        ? Math.round(((tests.length - failures) / tests.length) * 100)
        : 0,
    averageLatencyMs:
      latencies.length > 0
        ? Math.round(
            latencies.reduce((sum, latency) => sum + latency, 0) /
              latencies.length
          )
        : 0,
    items: tests.slice(0, 10),
  };
};

const getLatestReleaseInfo = async () => {
  try {
    const response = await axios.get(
      'https://api.github.com/repos/DomiGeim/agregarr/releases/latest',
      {
        timeout: 5000,
        headers: { 'User-Agent': 'Agregarr Dashboard' },
      }
    );

    return {
      version: String(response.data?.tag_name || '').replace(/^v/, ''),
      url: response.data?.html_url as string | undefined,
      publishedAt: response.data?.published_at as string | undefined,
    };
  } catch (error) {
    return null;
  }
};

const runSourceTest = async (
  sourceId: string,
  settings: ReturnType<typeof getSettings>
): Promise<SourceTestResult> => {
  const startedAt = Date.now();
  const finish = (
    result: Omit<SourceTestResult, 'id' | 'latencyMs' | 'testedAt'>
  ): SourceTestResult => {
    const testResult = {
      id: sourceId,
      latencyMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
      ...result,
    };

    sourceTestResults.set(sourceId, testResult);
    return testResult;
  };

  try {
    if (sourceId === 'tautulli') {
      const configured =
        !!settings.tautulli.hostname && !!settings.tautulli.apiKey;

      if (!configured) {
        return finish({
          name: 'Tautulli',
          configured,
          ok: false,
          message: 'Tautulli ist nicht vollstaendig konfiguriert.',
        });
      }

      await new TautulliAPI(settings.tautulli).getInfo();

      return finish({
        name: 'Tautulli',
        configured,
        ok: true,
        message: 'Tautulli antwortet.',
      });
    }

    if (sourceId === 'radarr') {
      const server = (settings.radarr || []).find(
        (item) => item.hostname && item.apiKey
      );

      if (!server) {
        return finish({
          name: 'Radarr',
          configured: false,
          ok: false,
          message: 'Kein Radarr-Server mit API-Key konfiguriert.',
        });
      }

      const radarr = new RadarrAPI({
        url: RadarrAPI.buildUrl(server, '/api/v3'),
        apiKey: server.apiKey,
      });
      const status = await radarr.getSystemStatus();

      return finish({
        name: 'Radarr',
        configured: true,
        ok: true,
        message: `Radarr ${status.version} antwortet.`,
      });
    }

    if (sourceId === 'sonarr') {
      const server = (settings.sonarr || []).find(
        (item) => item.hostname && item.apiKey
      );

      if (!server) {
        return finish({
          name: 'Sonarr',
          configured: false,
          ok: false,
          message: 'Kein Sonarr-Server mit API-Key konfiguriert.',
        });
      }

      const sonarr = new SonarrAPI({
        url: SonarrAPI.buildUrl(server, '/api/v3'),
        apiKey: server.apiKey,
      });
      const status = await sonarr.getSystemStatus();

      return finish({
        name: 'Sonarr',
        configured: true,
        ok: true,
        message: `Sonarr ${status.version} antwortet.`,
      });
    }

    const sourceStatus = getSourceStatus(settings).sources.find(
      (source) => source.id === sourceId
    );

    return finish({
      name: sourceStatus?.name || sourceId,
      configured: !!sourceStatus?.configured,
      ok: !!sourceStatus?.configured,
      message: sourceStatus?.configured
        ? 'Konfiguration vorhanden. Kein Live-Test fuer diese Quelle verfuegbar.'
        : 'Quelle ist nicht konfiguriert.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return finish({
      name: sourceId,
      configured: true,
      ok: false,
      message: 'Live-Test fehlgeschlagen.',
      error: message,
    });
  }
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
  trends: TrendStats | null,
  tautulliCollectionStats: {
    rating_key?: string;
    title?: string;
    total_plays?: number;
  }[] = []
) => {
  const allConfigs = getAllCollectionConfigs(settings);
  const placeholderRepository = getRepository(PlaceholderItem);
  const missingItemRepository = getRepository(MissingItemRequest);
  const metadataRepository = getRepository(CollectionMetadata);
  const now = Date.now();

  const [
    recentPlaceholders,
    recentRequests,
    recentMetadata,
    storedEvents,
    latestRelease,
  ] = await Promise.all([
    placeholderRepository
      .find({ order: { updatedAt: 'DESC' }, take: 8 })
      .catch(() => [] as PlaceholderItem[]),
    missingItemRepository
      .find({ order: { updatedAt: 'DESC' }, take: 8 })
      .catch(() => [] as MissingItemRequest[]),
    metadataRepository
      .find({ order: { updatedAt: 'DESC' }, take: 8 })
      .catch(() => [] as CollectionMetadata[]),
    readDashboardEvents(25),
    getLatestReleaseInfo(),
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
    ...storedEvents,
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
    const lastTest = sourceTestResults.get(source.id);
    const missingPenalty = source.configured ? 0 : 45;
    const unusedPenalty = source.usedByCollections === 0 ? 10 : 0;
    const failedTestPenalty = lastTest && !lastTest.ok ? 35 : 0;
    const latencyPenalty = lastTest?.latencyMs
      ? Math.min(20, Math.floor(lastTest.latencyMs / 1000) * 5)
      : 0;
    const score = Math.max(
      0,
      100 - missingPenalty - unusedPenalty - failedTestPenalty - latencyPenalty
    );

    return {
      id: source.id,
      name: source.name,
      score,
      status: score >= 90 ? 'ok' : score >= 60 ? 'watch' : 'attention',
      lastLatencyMs: lastTest?.latencyMs,
      lastTestedAt: lastTest?.testedAt,
      message: lastTest
        ? lastTest.ok
          ? `${source.usedByCollections || 0} Collections, letzter Test ${
              lastTest.latencyMs
            } ms`
          : lastTest.error || lastTest.message
        : source.configured
        ? `${source.usedByCollections || 0} Collections nutzen diese Quelle`
        : 'Quelle ist nicht konfiguriert',
    };
  });
  const problemDetails = getProblemDetails(
    settings,
    collectionScores,
    sourceStatus
  );
  const repairCandidates = getRepairCandidates(settings, collectionScores);
  const tautulliDataQuality = getTautulliDataQuality(
    settings,
    tautulliCollectionStats
  );
  const tautulliMappingDebugger = getTautulliMappingDebugger(
    settings,
    tautulliCollectionStats
  );
  const settingsConsistency = getSettingsConsistency(
    settings,
    collectionScores
  );
  const sourceTestHistory = getSourceTestHistory(storedEvents);
  const detailedSyncDryRun = await getDetailedSyncDryRun(settings);

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
    ...getWhyExplanations(settings, trends, tautulliDataQuality),
  ];
  const needsSync = allConfigs.filter((config) => config.needsSync);
  const errorConfigs = allConfigs.filter((config) => getLastSyncError(config));
  const missingRatingKeyConfigs = allConfigs.filter(
    (config) =>
      !hasCollectionRatingKey(config) &&
      getConfigType(config) !== 'filtered_hub' &&
      !config.missing
  );
  const duplicateNameCount =
    allConfigs.length -
    new Set(allConfigs.map((config) => config.name.trim().toLowerCase())).size;
  const multiSourceCount = allConfigs.filter(
    (config) => getConfigType(config) === 'multi-source'
  ).length;
  const linkedCount = allConfigs.filter(
    (config) => 'isLinked' in config && config.isLinked
  ).length;
  const autoRequestCount = allConfigs.filter(hasAutoHandling).length;
  const sourceAttentionCount = sourceReliability.filter(
    (source) => source.status !== 'ok'
  ).length;
  const rootFolderConfigured =
    (settings.radarr || []).some((server) => server.activeDirectory) ||
    (settings.sonarr || []).some((server) => server.activeDirectory);
  const operationsSuite = [
    {
      id: 'collection-diff-preview',
      title: 'Echte Collection Diff Preview',
      category: 'Sync',
      status: needsSync.length ? 'ready' : 'watch',
      metric: `${needsSync.length} changed`,
      summary:
        'Zeigt Collections, bei denen ein naechster Sync wahrscheinlich Unterschiede erzeugt.',
      href: '/allcollections',
    },
    {
      id: 'diagnostic-export',
      title: 'Diagnosebericht Download',
      category: 'Support',
      status: errorConfigs.length ? 'ready' : 'watch',
      metric: `${errorConfigs.length} errors`,
      summary:
        'Fasst Version, Quellen, Health und letzte Fehler ohne Tokens zusammen.',
      href: '/dashboard',
    },
    {
      id: 'source-test-center',
      title: 'Ausfuehrbares Source Test Center',
      category: 'Sources',
      status: sourceAttentionCount ? 'attention' : 'ready',
      metric: `${sourceAttentionCount} attention`,
      summary:
        'Buendelt Quellenstatus, Konfiguration und Zuverlaessigkeit pro Provider.',
      href: '/settings/sources',
    },
    {
      id: 'clickable-actions',
      title: 'Action Center mit echten Aktionen',
      category: 'Workflow',
      status: actionCenter.length ? 'ready' : 'watch',
      metric: `${actionCenter.length} actions`,
      summary:
        'Verlinkt direkt zu betroffenen Bereichen wie Collections oder Quellen.',
      href: '/dashboard',
    },
    {
      id: 'detail-drawer',
      title: 'Problem Details',
      category: 'UX',
      status: problemDetails.length ? 'ready' : 'watch',
      metric: `${problemDetails.length} problems`,
      summary: 'Warnungen bekommen Ursache, Bereich, Aktion und Ziel-Link.',
      href: '/dashboard',
    },
    {
      id: 'problem-collections',
      title: 'Problem Collections',
      category: 'Collections',
      status: criticalCollections.length ? 'attention' : 'ready',
      metric: `${criticalCollections.length} critical`,
      summary:
        'Listet kritische Collections mit Sync-Fehlern, fehlenden Keys oder Bibliotheken.',
      href: '/allcollections',
    },
    {
      id: 'activity-log',
      title: 'Persistente Collection Timeline',
      category: 'Timeline',
      status: collectionTimeline.length ? 'ready' : 'watch',
      metric: `${collectionTimeline.length} events`,
      summary:
        'Nutzt Requests, Placeholder und Metadata-Updates als Timeline-Signal.',
      href: '/dashboard',
    },
    {
      id: 'smart-notifications',
      title: 'Source-Test Verlauf',
      category: 'Alerts',
      status: sourceTestHistory.total ? 'ready' : 'watch',
      metric: `${sourceTestHistory.successRate}% success`,
      summary: 'Speichert Tests mit Erfolgsquote, Fehlern und Latenzsignalen.',
      href: '/dashboard',
    },
    {
      id: 'pin-to-dashboard',
      title: 'Wartungsmodus Banner',
      category: 'UX',
      status: settings.main.maintenanceMode ? 'attention' : 'ready',
      metric: settings.main.maintenanceMode ? 'visible' : 'ready',
      summary: 'Zeigt den aktiven Wartungsmodus sichtbar oben im Dashboard.',
      href: '/dashboard',
    },
    {
      id: 'maintenance-mode',
      title: 'Wartungsmodus',
      category: 'Safety',
      status: settings.main.maintenanceMode ? 'attention' : 'watch',
      metric: settings.main.maintenanceMode
        ? 'enabled'
        : collectionsSync.running
        ? 'sync running'
        : 'idle',
      summary:
        'Blockiert neue Dashboard-Sync-Aktionen, solange Wartungsarbeiten laufen.',
      href: '/dashboard',
    },
    {
      id: 'bulk-actions',
      title: 'Bulk-Aktionen',
      category: 'Workflow',
      status: needsSync.length > 1 ? 'ready' : 'watch',
      metric: `${needsSync.length} queued`,
      summary:
        'Gruppiert Collections mit gleichem Handlungsbedarf fuer spaetere Sammelaktionen.',
      href: '/allcollections',
    },
    {
      id: 'job-overview',
      title: 'Job-Uebersicht',
      category: 'Jobs',
      status: 'ready',
      metric: settings.main.lastGlobalSyncAt ? 'scheduled' : 'manual',
      summary:
        'Zeigt, ob automatische Collection-Syncs grundsaetzlich aktiv sind.',
      href: '/settings/jobs',
    },
    {
      id: 'sync-calendar',
      title: 'Sync-Kalender',
      category: 'Jobs',
      status: settings.main.lastGlobalSyncAt ? 'ready' : 'watch',
      metric: settings.main.lastGlobalSyncAt ? 'last sync set' : 'no sync',
      summary:
        'Nutzt letzten globalen Sync als Basis fuer eine Kalenderansicht.',
      href: '/dashboard',
    },
    {
      id: 'dependency-view',
      title: 'Collection Dependency View',
      category: 'Collections',
      status: linkedCount || multiSourceCount ? 'ready' : 'watch',
      metric: `${linkedCount + multiSourceCount} linked/multi`,
      summary:
        'Erkennt verlinkte und Multi-Source Collections als Abhaengigkeiten.',
      href: '/allcollections',
    },
    {
      id: 'multi-source-debugger',
      title: 'Multi-Source Debugger',
      category: 'Debugging',
      status: multiSourceCount ? 'ready' : 'watch',
      metric: `${multiSourceCount} multi-source`,
      summary:
        'Hebt Multi-Source Collections fuer detaillierte Quellenanalyse hervor.',
      href: '/allcollections',
    },
    {
      id: 'placeholder-detail',
      title: 'Placeholder-Detailseite',
      category: 'Placeholders',
      status: placeholderLifecycle.items.length ? 'ready' : 'watch',
      metric: `${placeholderLifecycle.items.length} recent`,
      summary:
        'Zeigt Alter, Quelle, Typ und Plex-Zuordnung der letzten Placeholder.',
      href: '/dashboard',
    },
    {
      id: 'rating-key-repair',
      title: 'Auto-Repair fuer Rating Keys',
      category: 'Repair',
      status: missingRatingKeyConfigs.length ? 'attention' : 'ready',
      metric: `${missingRatingKeyConfigs.length} missing keys`,
      summary:
        'Findet Collections ohne Plex Rating Key als Reparaturkandidaten.',
      href: '/allcollections',
    },
    {
      id: 'empty-collection-analysis',
      title: 'Warum ist diese Collection leer?',
      category: 'Analysis',
      status: collectionScores.some((score) => score.score < 85)
        ? 'ready'
        : 'watch',
      metric: `${
        collectionScores.filter((score) => score.score < 85).length
      } suspects`,
      summary:
        'Health-Gruende liefern erste Hinweise auf leere oder wertlose Collections.',
      href: '/allcollections',
    },
    {
      id: 'duplicate-detection',
      title: 'Doppelte Collections erkennen',
      category: 'Cleanup',
      status: duplicateNameCount ? 'attention' : 'ready',
      metric: `${duplicateNameCount} duplicates`,
      summary: 'Erkennt doppelte Collection-Namen als Cleanup-Kandidaten.',
      href: '/allcollections',
    },
    {
      id: 'source-watchlist',
      title: 'Watchlist fuer fehleranfaellige Quellen',
      category: 'Sources',
      status: sourceAttentionCount ? 'attention' : 'ready',
      metric: `${sourceAttentionCount} watched`,
      summary:
        'Quellen mit niedriger Reliability werden automatisch hervorgehoben.',
      href: '/settings/sources',
    },
    {
      id: 'tautulli-quality',
      title: 'Tautulli Datenqualitaets-Check',
      category: 'Tautulli',
      status: trends ? 'ready' : 'attention',
      metric: trends ? `${trends.currentWeekPlays} plays` : 'no data',
      summary:
        'Prueft, ob Tautulli Trends und Plays fuer Dashboard-Signale liefert.',
      href: '/settings/sources',
    },
    {
      id: 'arr-profile-audit',
      title: 'Radarr/Sonarr Profil-Audit',
      category: 'Downloads',
      status: autoRequestCount ? 'ready' : 'watch',
      metric: `${autoRequestCount} auto configs`,
      summary:
        'Findet Collections, die Download- oder Placeholder-Automation nutzen.',
      href: '/settings/downloads',
    },
    {
      id: 'root-folder-warning',
      title: 'Root-Folder und Speicherplatz-Warnungen',
      category: 'Downloads',
      status: rootFolderConfigured ? 'ready' : 'attention',
      metric: rootFolderConfigured ? 'configured' : 'missing',
      summary:
        'Prueft, ob mindestens ein Radarr/Sonarr Root Folder in Settings gesetzt ist.',
      href: '/settings/downloads',
    },
    {
      id: 'api-permission-check',
      title: 'API-Key und Berechtigungspruefung',
      category: 'Sources',
      status: sourceAttentionCount ? 'attention' : 'ready',
      metric: `${sourceStatus.configured}/${sourceStatus.total}`,
      summary:
        'Vergleicht konfigurierte Quellen mit Quellen, die Aufmerksamkeit brauchen.',
      href: '/settings/sources',
    },
    {
      id: 'backup-restore-preview',
      title: 'Restore-Dry-Run mit Diff',
      category: 'Backup',
      status: 'ready',
      metric: `${allConfigs.length} configs`,
      summary:
        'Settings-Umfang ist sichtbar und kann fuer sichere Restore-Vorschauen genutzt werden.',
      href: '/settings/main',
    },
    {
      id: 'collection-json-export',
      title: 'Import/Export einzelner Collections',
      category: 'Backup',
      status: 'ready',
      metric: `${allConfigs.length} collections`,
      summary:
        'Alle Collections sind eindeutig identifizierbar und exportierbar.',
      href: '/allcollections',
    },
    {
      id: 'template-library',
      title: 'Collection-Vorlagenbibliothek',
      category: 'Templates',
      status: 'watch',
      metric: `${
        new Set(allConfigs.map((config) => getConfigType(config))).size
      } types`,
      summary:
        'Vorhandene Collection-Typen bilden die Grundlage fuer wiederverwendbare Vorlagen.',
      href: '/allcollections',
    },
    {
      id: 'experiment-mode',
      title: 'Experiment Mode',
      category: 'Safety',
      status: 'watch',
      metric: `${needsSync.length} candidates`,
      summary:
        'Dry-Run-Daten zeigen, welche Collections sich fuer Testlaeufe ohne Plex-Aenderung eignen.',
      href: '/dashboard',
    },
    {
      id: 'sync-cost-estimate',
      title: 'Sync-Kosten-Schaetzung',
      category: 'Sync',
      status: 'ready',
      metric: `${allConfigs.length + autoRequestCount} units`,
      summary:
        'Schaetzt Aufwand aus Collection-Anzahl plus aktivem Missing-Media-Handling.',
      href: '/dashboard',
    },
    {
      id: 'dashboard-search',
      title: 'Dashboard-Suche',
      category: 'Search',
      status: 'watch',
      metric: `${
        allConfigs.length + recentPlaceholders.length + recentRequests.length
      } indexed`,
      summary:
        'Collections, Placeholder und Requests werden als Suchbasis zusammengefuehrt.',
      href: '/dashboard',
    },
    {
      id: 'tautulli-data-quality',
      title: 'Tautulli Datenqualitaet pro Collection',
      category: 'Tautulli',
      status: tautulliDataQuality.noTautulliMatchCount ? 'watch' : 'ready',
      metric: `${tautulliDataQuality.tautulliMatchedCollections} matched`,
      summary:
        'Zeigt Collections ohne Rating Key oder ohne Treffer in Tautulli.',
      href: '/dashboard',
    },
    {
      id: 'release-update-hint',
      title: 'Release/Update Hinweis',
      category: 'Release',
      status:
        latestRelease && latestRelease.version !== getAppVersion()
          ? 'attention'
          : 'ready',
      metric: latestRelease?.version || getAppVersion(),
      summary:
        'Vergleicht die installierte Version mit dem neuesten GitHub Release.',
      href: latestRelease?.url || '/settings/about',
    },
    {
      id: 'audit-log',
      title: 'Audit Log',
      category: 'Audit',
      status: storedEvents.length ? 'ready' : 'watch',
      metric: `${storedEvents.length} events`,
      summary:
        'Zeichnet Dashboard-Aktionen wie Tests, Wartung und Sync-Starts dauerhaft auf.',
      href: '/dashboard',
    },
    {
      id: 'tautulli-artwork-cache',
      title: 'Tautulli Artwork Cache',
      category: 'Tautulli',
      status: tautulliDataQuality.artworkCache.candidateCount
        ? 'ready'
        : 'watch',
      metric: `${tautulliDataQuality.artworkCache.candidateCount} candidates`,
      summary:
        'Dashboard nutzt stabile Proxy-URLs, damit Poster wiederverwendbar geladen werden.',
      href: '/dashboard',
    },
  ].map((item, index) => ({
    ...item,
    number: index + 1,
  }));

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
    sourceTests: Array.from(sourceTestResults.values()).sort(
      (a, b) => new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime()
    ),
    sourceTestHistory,
    problemDetails,
    repairCandidates,
    tautulliDataQuality,
    tautulliMappingDebugger,
    settingsConsistency,
    detailedSyncDryRun,
    dashboardPerformance: {
      cacheTtlMs: DASHBOARD_CACHE_TTL_MS,
      cacheEntries: dashboardCache.size,
      strategy:
        'Fast settings and database signals render first; Tautulli-heavy data is cached for short dashboard refreshes.',
    },
    releaseStatus: {
      installedVersion: getAppVersion(),
      latestVersion: latestRelease?.version,
      latestUrl: latestRelease?.url,
      updateAvailable:
        !!latestRelease && latestRelease.version !== getAppVersion(),
      publishedAt: latestRelease?.publishedAt,
    },
    auditLog: storedEvents.slice(0, 10),
    placeholderLifecycle,
    explainers,
    availableActions: [
      {
        id: 'sync-collections',
        title: 'Collections synchronisieren',
        danger: true,
      },
      {
        id: 'test-tautulli',
        title: 'Tautulli testen',
        danger: false,
      },
      {
        id: 'export-diagnostics',
        title: 'Diagnosebericht herunterladen',
        danger: false,
      },
    ],
    operationsSuite,
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
    let tautulliCollectionStats: {
      rating_key?: string;
      title?: string;
      total_plays?: number;
    }[] = [];

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
        tautulliCollectionStats = collectionStats;

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
      trendStats,
      tautulliCollectionStats
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
      maintenanceMode: {
        enabled: !!settings.main.maintenanceMode,
        syncRunning: collectionsSync.running,
      },
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

dashboardRoutes.get('/diagnostics', isAuthenticated(), async (_req, res) => {
  const settings = getSettings();
  const healthScores = getCollectionHealthScores(settings);
  const sourceStatus = getSourceStatus(settings);
  const report = {
    generatedAt: new Date().toISOString(),
    version: getAppVersion(),
    health: getCollectionHealth(settings),
    collectionHealthScores: healthScores,
    sourceStatus,
    previews: await getDashboardPreviews(settings),
    sourceTestResults: Array.from(sourceTestResults.values()),
    maintenanceMode: !!settings.main.maintenanceMode,
    syncStatus: collectionsSync.status,
    settings: sanitizeSettings(settings.getAll()),
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="agregarr-diagnostics-${timestamp}.json"`
  );

  return res.status(200).send(JSON.stringify(report, undefined, ' '));
});

dashboardRoutes.get(
  '/collection-diff/:id',
  isAuthenticated(),
  async (req, res) => {
    const settings = getSettings();
    const config = getAllCollectionConfigs(settings).find(
      (item) => item.id === req.params.id
    );

    if (!config) {
      return res.status(404).json({ message: 'Collection config not found' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const missingItemRepository = getRepository(MissingItemRequest);
    const placeholderRepository = getRepository(PlaceholderItem);
    const [pendingMissingItems, placeholders] = await Promise.all([
      missingItemRepository
        .createQueryBuilder('missing')
        .where('missing.collectionName = :name', { name: config.name })
        .orderBy('missing.updatedAt', 'DESC')
        .limit(limit)
        .getMany()
        .catch(() => [] as MissingItemRequest[]),
      placeholderRepository
        .createQueryBuilder('placeholder')
        .where('placeholder.configId = :configId', { configId: config.id })
        .orderBy('placeholder.updatedAt', 'DESC')
        .limit(limit)
        .getMany()
        .catch(() => [] as PlaceholderItem[]),
    ]);
    const configRecord = config as DashboardCollectionConfig & {
      collectionRatingKey?: string;
      collectionRatingKeys?: string[];
    };
    const currentPlexKeys = [
      configRecord.collectionRatingKey,
      ...(configRecord.collectionRatingKeys || []),
    ].filter(Boolean);

    return res.status(200).json({
      collection: {
        id: config.id,
        name: config.name,
        type: getConfigType(config),
        libraryName: config.libraryName,
        needsSync: !!config.needsSync,
        lastSyncError: getLastSyncError(config),
      },
      currentPlexKeys,
      plannedAdds: pendingMissingItems.map((item) => ({
        id: item.id,
        title: item.title,
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        status: item.requestStatus,
        updatedAt: item.updatedAt,
      })),
      placeholders: placeholders.map((item) => ({
        id: item.id,
        title: item.title,
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        source: item.source,
        hasPlexRatingKey: !!item.plexRatingKey,
        updatedAt: item.updatedAt,
      })),
      plannedRemovals: [],
      summary: {
        trackedAdds: pendingMissingItems.length,
        trackedPlaceholders: placeholders.length,
        knownPlexCollections: currentPlexKeys.length,
      },
    });
  }
);

dashboardRoutes.get('/placeholders', isAuthenticated(), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 250);
  const status = req.query.status as string | undefined;
  const placeholderRepository = getRepository(PlaceholderItem);
  let query = placeholderRepository
    .createQueryBuilder('placeholder')
    .orderBy('placeholder.updatedAt', 'DESC')
    .limit(limit);

  if (status === 'linked') {
    query = query.where('placeholder.plexRatingKey IS NOT NULL');
  } else if (status === 'unlinked') {
    query = query.where('placeholder.plexRatingKey IS NULL');
  }

  const items = await query.getMany().catch(() => [] as PlaceholderItem[]);
  const now = Date.now();

  return res.status(200).json({
    total: items.length,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      source: item.source,
      configId: item.configId,
      ageDays: Math.max(
        0,
        Math.floor((now - item.createdAt.getTime()) / 86400000)
      ),
      hasPlexRatingKey: !!item.plexRatingKey,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
});

dashboardRoutes.get('/problems', isAuthenticated(), (_req, res) => {
  const settings = getSettings();
  const collectionHealthScores = getCollectionHealthScores(settings);
  const sourceStatus = getSourceStatus(settings);

  return res.status(200).json({
    problems: getProblemDetails(settings, collectionHealthScores, sourceStatus),
  });
});

dashboardRoutes.get('/repair-candidates', isAuthenticated(), (_req, res) => {
  const settings = getSettings();
  const collectionHealthScores = getCollectionHealthScores(settings);

  return res.status(200).json({
    candidates: getRepairCandidates(settings, collectionHealthScores),
  });
});

dashboardRoutes.get('/first-aid', isAuthenticated(), async (_req, res) => {
  const settings = getSettings();
  const collectionHealthScores = getCollectionHealthScores(settings);
  const sourceStatus = getSourceStatus(settings);
  const [tautulli, radarr, sonarr] = await Promise.all([
    runSourceTest('tautulli', settings),
    runSourceTest('radarr', settings),
    runSourceTest('sonarr', settings),
  ]);
  const consistency = getSettingsConsistency(settings, collectionHealthScores);
  const problems = getProblemDetails(
    settings,
    collectionHealthScores,
    sourceStatus
  );
  const checks = [
    {
      id: 'media-server',
      ok: !!settings.plex.ip,
      title: 'Media Server',
      message: settings.plex.ip
        ? `${settings.plex.mediaServerType || 'plex'} konfiguriert`
        : 'Media Server fehlt',
    },
    {
      id: 'tautulli',
      ok: tautulli.ok,
      title: 'Tautulli',
      message: tautulli.error || tautulli.message,
    },
    {
      id: 'radarr',
      ok: radarr.ok,
      title: 'Radarr',
      message: radarr.error || radarr.message,
    },
    {
      id: 'sonarr',
      ok: sonarr.ok,
      title: 'Sonarr',
      message: sonarr.error || sonarr.message,
    },
    {
      id: 'collections',
      ok: collectionHealthScores.some((score) => score.status === 'critical')
        ? false
        : true,
      title: 'Collections',
      message: `${collectionHealthScores.length} Collections geprueft`,
    },
    {
      id: 'backup',
      ok: true,
      title: 'Backup',
      message: 'Backup-Export und Restore-Preview Endpunkte sind verfuegbar.',
    },
  ];
  const failedChecks = checks.filter((check) => !check.ok);

  await appendDashboardEvent({
    type: 'first-aid',
    title: 'First Aid Diagnose ausgefuehrt',
    message: `${failedChecks.length} Checks brauchen Aufmerksamkeit.`,
    metadata: {
      failedChecks: failedChecks.length,
    },
  });

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    status:
      failedChecks.length === 0
        ? 'healthy'
        : failedChecks.length <= 2
        ? 'watch'
        : 'attention',
    likelyCause:
      failedChecks[0]?.message ||
      consistency[0]?.message ||
      problems[0]?.message ||
      'Keine offensichtliche Ursache gefunden.',
    checks,
    consistency,
    problems,
  });
});

dashboardRoutes.get('/sync-dry-run', isAuthenticated(), async (_req, res) => {
  return res.status(200).json(await getDetailedSyncDryRun(getSettings()));
});

dashboardRoutes.get(
  '/tautulli-mapping',
  isAuthenticated(),
  async (_req, res) => {
    const settings = getSettings();
    const collectionRatingKeys = getCollectionRatingKeys(settings);
    let collectionStats: {
      rating_key?: string;
      title?: string;
      total_plays?: number;
    }[] = [];

    if (settings.tautulli.hostname && settings.tautulli.apiKey) {
      try {
        collectionStats = await new TautulliAPI(settings.tautulli)
          .getTopCollections(100, 'plays', 30, collectionRatingKeys, {
            includeMetadata: false,
            includeUserStats: false,
            concurrency: 4,
          })
          .then((items) =>
            items.map((item) => ({
              rating_key: item.rating_key,
              title: item.title,
              total_plays: item.total_plays,
            }))
          );
      } catch (error) {
        logger.warn('Failed to load Tautulli mapping debugger data', {
          label: 'Dashboard API',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return res.status(200).json({
      mapping: getTautulliMappingDebugger(settings, collectionStats),
    });
  }
);

dashboardRoutes.get('/settings-consistency', isAuthenticated(), (_req, res) => {
  const settings = getSettings();

  return res.status(200).json({
    issues: getSettingsConsistency(
      settings,
      getCollectionHealthScores(settings)
    ),
  });
});

dashboardRoutes.get('/audit-log', isAuthenticated(), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 250);

  return res.status(200).json({
    events: await readDashboardEvents(limit),
  });
});

dashboardRoutes.get('/version-check', isAuthenticated(), async (_req, res) => {
  const latestRelease = await getLatestReleaseInfo();

  return res.status(200).json({
    installedVersion: getAppVersion(),
    latestVersion: latestRelease?.version,
    latestUrl: latestRelease?.url,
    updateAvailable:
      !!latestRelease && latestRelease.version !== getAppVersion(),
    publishedAt: latestRelease?.publishedAt,
  });
});

dashboardRoutes.get(
  '/collections/:id/export',
  isAuthenticated(),
  async (req, res) => {
    const settings = getSettings();
    const config = getAllCollectionConfigs(settings).find(
      (item) => item.id === req.params.id
    );

    if (!config) {
      return res.status(404).json({ message: 'Collection config not found' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="agregarr-collection-${config.id}-${timestamp}.json"`
    );

    return res.status(200).send(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          version: getAppVersion(),
          type: getConfigType(config),
          collection: config,
        },
        undefined,
        ' '
      )
    );
  }
);

dashboardRoutes.get(
  '/collections/:id/detail',
  isAuthenticated(),
  async (req, res) => {
    const settings = getSettings();
    const config = getAllCollectionConfigs(settings).find(
      (item) => item.id === req.params.id
    );

    if (!config) {
      return res.status(404).json({ message: 'Collection config not found' });
    }

    const scores = getCollectionHealthScores(settings);
    const health = scores.find((score) => score.id === config.id);
    const missingItemRepository = getRepository(MissingItemRequest);
    const placeholderRepository = getRepository(PlaceholderItem);
    const [missingItems, placeholders, events] = await Promise.all([
      missingItemRepository
        .createQueryBuilder('missing')
        .where('missing.collectionName = :name', { name: config.name })
        .orderBy('missing.updatedAt', 'DESC')
        .limit(25)
        .getMany()
        .catch(() => [] as MissingItemRequest[]),
      placeholderRepository
        .createQueryBuilder('placeholder')
        .where('placeholder.configId = :configId', { configId: config.id })
        .orderBy('placeholder.updatedAt', 'DESC')
        .limit(25)
        .getMany()
        .catch(() => [] as PlaceholderItem[]),
      readDashboardEvents(100),
    ]);

    return res.status(200).json({
      collection: {
        id: config.id,
        name: config.name,
        type: getConfigType(config),
        libraryName: config.libraryName,
        collectionRatingKey: config.collectionRatingKey,
        needsSync: !!config.needsSync,
        lastSyncError: getLastSyncError(config),
      },
      health,
      missingItems,
      placeholders,
      events: events.filter((event) =>
        JSON.stringify(event).toLowerCase().includes(config.id.toLowerCase())
      ),
      exportUrl: `/api/v1/dashboard/collections/${config.id}/export`,
      diffUrl: `/api/v1/dashboard/collection-diff/${config.id}`,
    });
  }
);

dashboardRoutes.post(
  '/repair/:actionId',
  isAuthenticated(),
  async (req, res) => {
    const settings = getSettings();
    const actionId = req.params.actionId;
    const configId = String(req.body?.configId || '');
    const allConfigs = getAllCollectionConfigs(settings);
    const config = allConfigs.find((item) => item.id === configId) as
      | (DashboardCollectionConfig & {
          needsSync?: boolean;
          visibilityConfig?: DashboardCollectionConfig['visibilityConfig'];
        })
      | undefined;

    if (!config) {
      return res.status(404).json({ message: 'Collection config not found' });
    }

    if (actionId === 'retry-sync' || actionId === 'repair-rating-key') {
      config.needsSync = true;
    } else if (actionId === 'make-visible') {
      config.visibilityConfig = {
        ...(config.visibilityConfig || {}),
        serverOwnerHome: true,
        libraryRecommended: true,
      };
      config.needsSync = true;
    } else {
      return res.status(404).json({ message: 'Unknown repair action' });
    }

    settings.save();
    dashboardCache.clear();
    await appendDashboardEvent({
      type: 'repair',
      title: 'Repair-Aktion vorgemerkt',
      message: `${actionId} fuer ${config.name}`,
      metadata: {
        actionId,
        configId,
      },
    });

    return res.status(200).json({
      success: true,
      configId,
      actionId,
      needsSync: config.needsSync,
    });
  }
);

dashboardRoutes.post(
  '/source-test/:sourceId',
  isAuthenticated(),
  async (req, res) => {
    const result = await runSourceTest(req.params.sourceId, getSettings());

    await appendDashboardEvent({
      type: 'source-test',
      title: `${result.name} getestet`,
      message: result.ok ? result.message : result.error || result.message,
      metadata: {
        sourceId: result.id,
        ok: result.ok,
        latencyMs: result.latencyMs,
      },
    });
    dashboardCache.clear();

    return res.status(200).json(result);
  }
);

dashboardRoutes.post(
  '/actions/:actionId',
  isAuthenticated(),
  async (req, res) => {
    const settings = getSettings();
    const actionId = req.params.actionId;

    if (actionId === 'sync-collections') {
      if (settings.main.maintenanceMode) {
        return res.status(409).json({
          success: false,
          message: 'Maintenance mode is enabled. Collection sync is paused.',
        });
      }

      if (!collectionsSync.running) {
        collectionsSync.run().catch((error) => {
          logger.error('Dashboard-triggered collection sync failed', {
            label: 'Dashboard API',
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      await appendDashboardEvent({
        type: 'action',
        title: 'Collections Sync gestartet',
        message: 'Dashboard Action Center hat einen Collection Sync gestartet.',
        metadata: {
          actionId,
        },
      });
      dashboardCache.clear();

      return res.status(202).json({
        success: true,
        message: 'Collection sync started',
        status: collectionsSync.status,
      });
    }

    if (actionId === 'test-tautulli') {
      const result = await runSourceTest('tautulli', settings);

      await appendDashboardEvent({
        type: 'source-test',
        title: 'Tautulli getestet',
        message: result.ok ? result.message : result.error || result.message,
        metadata: {
          sourceId: result.id,
          ok: result.ok,
          latencyMs: result.latencyMs,
        },
      });
      dashboardCache.clear();

      return res.status(200).json(result);
    }

    if (actionId === 'export-diagnostics') {
      return res.status(200).json({
        success: true,
        url: '/api/v1/dashboard/diagnostics',
      });
    }

    return res.status(404).json({ message: 'Unknown dashboard action' });
  }
);

dashboardRoutes.get(
  '/settings-backup',
  isAuthenticated(),
  async (_req, res) => {
    const settingsPath = path.join(appDataPath(), 'settings.json');
    let backup = '';

    try {
      backup = await fs.readFile(settingsPath, 'utf-8');
    } catch (error) {
      backup = JSON.stringify(getSettings().getAll(), undefined, ' ');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="agregarr-settings-${timestamp}.json"`
    );

    return res.status(200).send(backup);
  }
);

dashboardRoutes.post(
  '/settings-restore-preview',
  isAuthenticated(),
  (req, res) => {
    const backupStatus = validateSettingsBackup(req.body);
    const currentSettings = getSettings().getAll();
    const incoming = req.body as {
      main?: unknown;
      plex?: {
        collectionConfigs?: unknown[];
        preExistingCollectionConfigs?: unknown[];
      };
    };

    return res.status(backupStatus.valid ? 200 : 400).json({
      ...backupStatus,
      changedSections: buildSettingsRestoreDiff(
        currentSettings as unknown as Record<string, unknown>,
        req.body as Record<string, unknown>
      ),
      current: {
        locale: currentSettings.main.locale,
        collectionCount:
          (currentSettings.plex.collectionConfigs?.length || 0) +
          (currentSettings.plex.preExistingCollectionConfigs?.length || 0),
      },
      incoming: {
        locale: (incoming.main as { locale?: string } | undefined)?.locale,
        collectionCount: backupStatus.collectionCount,
      },
    });
  }
);

dashboardRoutes.get('/maintenance', isAuthenticated(), (_req, res) => {
  const settings = getSettings();

  return res.status(200).json({
    enabled: !!settings.main.maintenanceMode,
    syncRunning: collectionsSync.running,
  });
});

dashboardRoutes.post('/maintenance', isAuthenticated(), async (req, res) => {
  const settings = getSettings();
  const enabled = !!req.body?.enabled;

  settings.main.maintenanceMode = enabled;
  settings.save();

  await appendDashboardEvent({
    type: 'maintenance',
    title: enabled ? 'Wartungsmodus aktiviert' : 'Wartungsmodus deaktiviert',
    message: enabled
      ? 'Neue Dashboard-Sync-Aktionen werden pausiert.'
      : 'Dashboard-Sync-Aktionen sind wieder erlaubt.',
    metadata: {
      enabled,
    },
  });
  dashboardCache.clear();

  return res.status(200).json({
    enabled,
    syncRunning: collectionsSync.running,
  });
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
