import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import {
  ArrowUpCircleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CogIcon,
  ExclamationCircleIcon,
  FilmIcon,
  EyeSlashIcon,
  PlayIcon,
  RectangleStackIcon as CollectionIcon,
  ServerStackIcon,
  TvIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { StatusResponse } from '@server/interfaces/api/settingsInterfaces';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages({
  collections: 'Collections',
  collectionPlays: 'Collection Views',
  movieCollectionPlays: 'Movie Collection Views',
  tvCollectionPlays: 'TV Collection Views',
  preExistingCollections: 'Pre-existing',
  totalServer: 'total',
  thisWeek: 'this week',
  tautulliRequired: 'Tautulli Setup Required',
  tautulliDescriptionPlayStats:
    'Configure Tautulli in your settings to view play statistics from your Plex server.',
  tautulliUnavailable:
    'Tautulli is configured, but play statistics could not be loaded.',
  configureTautulli: 'Configure Tautulli',
  failedToLoadDashboardStats: 'Failed to load dashboard statistics',
  collectionHealth: 'Collection Health',
  healthOk: 'No collection issues found',
  healthIssues: '{count} issue(s) found',
  errors: 'errors',
  warnings: 'warnings',
  loadingDashboardStats: 'Loading dashboard statistics...',
  tautulliTimedOut:
    'Tautulli is responding slowly. Showing collection data without play statistics.',
  tautulliPlexOnly:
    'Tautulli play statistics are only available for Plex profiles. Your active media server is {mediaServer}.',
  mediaServer: 'Media Server',
  libraries: 'libraries',
  active: 'active',
  sourceStatus: 'Source Status',
  sourcesConfigured: '{configured} of {total} configured',
  configured: 'Configured',
  missing: 'Missing',
  updateAvailable: 'Update Available',
  updateDockerImage:
    'A newer version is available for your Docker image. Installed: {installedVersion}. Latest: {latestVersion}.',
  collapseTile: 'Collapse tile',
  expandTile: 'Expand tile',
  hideTile: 'Hide tile',
  showAllTiles: 'Show all tiles',
  hiddenTiles: '{count} dashboard tile(s) hidden',
  mediaServerCapabilities: 'Media Server Capabilities',
});

interface DashboardData {
  mediaServer?: {
    activeType: 'plex' | 'jellyfin' | 'emby';
    name?: string;
    libraryCount: number;
    lastGlobalSyncAt?: string;
    globalSyncError?: string;
    profiles: {
      plex: {
        configured: boolean;
        libraryCount: number;
      };
      jellyfin: {
        configured: boolean;
        libraryCount: number;
      };
      emby: {
        configured: boolean;
        libraryCount: number;
      };
    };
    capabilities?: {
      id: string;
      label: string;
      available: boolean;
      note: string;
    }[];
  };
  collections: {
    agregarr: number;
    preExisting: number;
    total: number;
    stats?: {
      topCollections: unknown[];
      totalCollections: number;
      collectionPlays: {
        total: number;
        movies: number;
        tv: number;
      };
    };
  };
  activity?: {
    totalPlays: number;
    moviePlays: number;
    tvPlays: number;
    collectionPlays: number;
  };
  tautulli?: {
    isConnected: boolean;
    configured?: boolean;
    statsAvailable?: boolean;
    error?: string;
    timedOut?: boolean;
    plexOnly?: boolean;
    activeMediaServerType?: 'plex' | 'jellyfin' | 'emby';
    weeklyActivity?: {
      totalPlays: number;
      moviePlays: number;
      tvPlays: number;
      collectionPlays: number;
    };
  };
  sourceStatus?: {
    configured: number;
    total: number;
    sources: {
      id: string;
      name: string;
      configured: boolean;
    }[];
  };
  health?: {
    status: 'ok' | 'warning' | 'error';
    totals: {
      errors: number;
      warnings: number;
      info: number;
    };
    issues: {
      severity: 'error' | 'warning' | 'info';
      area: string;
      message: string;
    }[];
  };
  timestamp: string;
}

const StatCard = ({
  tileId,
  title,
  value,
  icon: Icon,
  subtitle,
  collapsed = false,
  onToggleCollapse,
  onHide,
}: {
  tileId?: string;
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  collapsed?: boolean;
  onToggleCollapse?: (tileId: string) => void;
  onHide?: (tileId: string) => void;
}) => (
  <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-400">{title}</p>
        {!collapsed && (
          <>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Icon className="h-8 w-8 text-orange-400" />
        {tileId && onToggleCollapse && (
          <button
            type="button"
            aria-label={collapsed ? 'Expand tile' : 'Collapse tile'}
            className="text-gray-500 transition hover:text-gray-200"
            onClick={() => onToggleCollapse(tileId)}
          >
            {collapsed ? (
              <ChevronDownIcon className="h-5 w-5" />
            ) : (
              <ChevronUpIcon className="h-5 w-5" />
            )}
          </button>
        )}
        {tileId && onHide && (
          <button
            type="button"
            aria-label="Hide tile"
            className="text-gray-500 transition hover:text-gray-200"
            onClick={() => onHide(tileId)}
          >
            <EyeSlashIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  </div>
);

const DashboardStats: React.FC = () => {
  const intl = useIntl();
  const [collapsedTiles, setCollapsedTiles] = useState<string[]>([]);
  const [hiddenTiles, setHiddenTiles] = useState<string[]>([]);
  const { data: dashboardData, error } = useSWR<DashboardData>(
    '/api/v1/dashboard/stats'
  );
  const { data: statusData } = useSWR<StatusResponse>('/api/v1/status', {
    refreshInterval: 60 * 1000,
  });
  const collapsedStorageKey = 'agregarr-dashboard-stat-collapsed';
  const hiddenStorageKey = 'agregarr-dashboard-stat-hidden';

  useEffect(() => {
    try {
      setCollapsedTiles(JSON.parse(localStorage.getItem(collapsedStorageKey) || '[]'));
      setHiddenTiles(JSON.parse(localStorage.getItem(hiddenStorageKey) || '[]'));
    } catch {
      setCollapsedTiles([]);
      setHiddenTiles([]);
    }
  }, []);

  const toggleCollapsedTile = (tileId: string) => {
    setCollapsedTiles((current) => {
      const next = current.includes(tileId)
        ? current.filter((id) => id !== tileId)
        : [...current, tileId];
      localStorage.setItem(collapsedStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const hideTile = (tileId: string) => {
    setHiddenTiles((current) => {
      const next = current.includes(tileId) ? current : [...current, tileId];
      localStorage.setItem(hiddenStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const showAllTiles = () => {
    setHiddenTiles([]);
    localStorage.removeItem(hiddenStorageKey);
  };

  const renderStatCard = (
    tileId: string,
    props: Omit<
      React.ComponentProps<typeof StatCard>,
      'tileId' | 'collapsed' | 'onToggleCollapse' | 'onHide'
    >
  ) =>
    hiddenTiles.includes(tileId) ? null : (
      <StatCard
        tileId={tileId}
        collapsed={collapsedTiles.includes(tileId)}
        onToggleCollapse={toggleCollapsedTile}
        onHide={hideTile}
        {...props}
      />
    );

  if (error) {
    return (
      <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
        <div className="text-center">
          <p className="text-red-400">
            {intl.formatMessage(messages.failedToLoadDashboardStats)}
          </p>
          <p className="mt-1 text-sm text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner />
            <p className="text-sm text-gray-400">
              {intl.formatMessage(messages.loadingDashboardStats)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const mediaServerName =
    dashboardData.mediaServer?.activeType === 'jellyfin'
      ? 'Jellyfin'
      : dashboardData.mediaServer?.activeType === 'emby'
      ? 'Emby'
      : 'Plex';

  // Check if Tautulli is not configured
  const isTautulliConfigured =
    dashboardData.tautulli?.configured === true ||
    dashboardData.tautulli?.isConnected === true ||
    dashboardData.activity != null;

  if (dashboardData.tautulli?.plexOnly) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={intl.formatMessage(messages.mediaServer)}
            value={mediaServerName}
            icon={ServerStackIcon}
            subtitle={`${
              dashboardData.mediaServer?.libraryCount || 0
            } ${intl.formatMessage(messages.libraries)} • ${intl.formatMessage(
              messages.active
            )}`}
          />
          <StatCard
            title={intl.formatMessage(messages.collections)}
            value={dashboardData.collections.agregarr}
            icon={CollectionIcon}
            subtitle={`${
              dashboardData.collections.preExisting
            } ${intl.formatMessage(messages.preExistingCollections)}`}
          />
        </div>
        <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
          <div className="flex flex-col items-center py-8 text-center">
            <ServerStackIcon className="mb-4 h-12 w-12 text-orange-400" />
            <h4 className="mb-2 text-lg font-semibold text-white">
              Tautulli
            </h4>
            <p className="max-w-md text-gray-400">
              {intl.formatMessage(messages.tautulliPlexOnly, {
                mediaServer: mediaServerName,
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If Tautulli is not configured, show setup message
  if (!isTautulliConfigured) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={intl.formatMessage(messages.mediaServer)}
            value={mediaServerName}
            icon={ServerStackIcon}
            subtitle={`${
              dashboardData.mediaServer?.libraryCount || 0
            } ${intl.formatMessage(messages.libraries)} • ${intl.formatMessage(
              messages.active
            )}`}
          />
          <StatCard
            title={intl.formatMessage(messages.collections)}
            value={dashboardData.collections.agregarr}
            icon={CollectionIcon}
            subtitle={`${
              dashboardData.collections.preExisting
            } ${intl.formatMessage(messages.preExistingCollections)}`}
          />
        </div>
        <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
          <div className="flex flex-col items-center py-8 text-center">
            <ExclamationCircleIcon className="mb-4 h-12 w-12 text-orange-400" />
            <h4 className="mb-2 text-lg font-semibold text-white">
              {intl.formatMessage(messages.tautulliRequired)}
            </h4>
            <p className="mb-6 max-w-md text-gray-400">
              {intl.formatMessage(messages.tautulliDescriptionPlayStats)}
            </p>
            <Link href="/settings/sources" passHref>
              <Button as="a" buttonType="primary">
                <CogIcon className="mr-2 h-5 w-5" />
                {intl.formatMessage(messages.configureTautulli)}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const collectionPlays =
    dashboardData.activity?.collectionPlays ||
    dashboardData.tautulli?.weeklyActivity?.collectionPlays ||
    0;
  const totalPlays =
    dashboardData.activity?.totalPlays ||
    dashboardData.tautulli?.weeklyActivity?.totalPlays ||
    0;
  const movieCollectionPlays =
    dashboardData.collections.stats?.collectionPlays.movies || 0;
  const tvCollectionPlays =
    dashboardData.collections.stats?.collectionPlays.tv || 0;
  const totalMoviePlays =
    dashboardData.activity?.moviePlays ||
    dashboardData.tautulli?.weeklyActivity?.moviePlays ||
    0;
  const totalTvPlays =
    dashboardData.activity?.tvPlays ||
    dashboardData.tautulli?.weeklyActivity?.tvPlays ||
    0;
  const hasTautulliStats =
    dashboardData.tautulli?.isConnected === true ||
    dashboardData.activity != null;
  const healthIssueCount =
    (dashboardData.health?.totals.errors || 0) +
    (dashboardData.health?.totals.warnings || 0) +
    (dashboardData.health?.totals.info || 0);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {hiddenTiles.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-stone-800 p-4 shadow-sm sm:col-span-2 lg:col-span-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-300">
              {intl.formatMessage(messages.hiddenTiles, {
                count: hiddenTiles.length,
              })}
            </p>
            <Button buttonType="default" onClick={showAllTiles}>
              {intl.formatMessage(messages.showAllTiles)}
            </Button>
          </div>
        </div>
      )}
      {renderStatCard('media-server', {
        title: intl.formatMessage(messages.mediaServer),
        value: mediaServerName,
        icon: ServerStackIcon,
        subtitle: `${
          dashboardData.mediaServer?.libraryCount || 0
        } ${intl.formatMessage(messages.libraries)} / ${intl.formatMessage(
          messages.active
        )}`,
      })}
      {renderStatCard('collections', {
        title: intl.formatMessage(messages.collections),
        value: dashboardData.collections.agregarr,
        icon: CollectionIcon,
        subtitle: `${
          dashboardData.collections.preExisting
        } ${intl.formatMessage(messages.preExistingCollections)}`,
      })}
      {renderStatCard('collection-plays', {
        title: intl.formatMessage(messages.collectionPlays),
        value: hasTautulliStats ? collectionPlays : '-',
        icon: PlayIcon,
        subtitle: `${totalPlays} ${intl.formatMessage(
          messages.totalServer
        )} / ${intl.formatMessage(messages.thisWeek)}`,
      })}
      {renderStatCard('movie-collection-plays', {
        title: intl.formatMessage(messages.movieCollectionPlays),
        value: hasTautulliStats ? movieCollectionPlays : '-',
        icon: FilmIcon,
        subtitle: `${totalMoviePlays} ${intl.formatMessage(
          messages.totalServer
        )} / ${intl.formatMessage(messages.thisWeek)}`,
      })}
      {renderStatCard('tv-collection-plays', {
        title: intl.formatMessage(messages.tvCollectionPlays),
        value: hasTautulliStats ? tvCollectionPlays : '-',
        icon: TvIcon,
        subtitle: `${totalTvPlays} ${intl.formatMessage(
          messages.totalServer
        )} / ${intl.formatMessage(messages.thisWeek)}`,
      })}
      {statusData?.updateAvailable && (
        <div className="rounded-lg border border-orange-500/40 bg-stone-800 p-6 shadow-sm sm:col-span-2 lg:col-span-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-orange-300">
                {intl.formatMessage(messages.updateAvailable)}
              </p>
              <p className="mt-1 text-sm text-gray-300">
                {intl.formatMessage(messages.updateDockerImage, {
                  installedVersion: statusData.version,
                  latestVersion: statusData.latestVersion || 'latest',
                })}
              </p>
            </div>
            <ArrowUpCircleIcon className="h-8 w-8 text-orange-400" />
          </div>
          <code className="mt-4 block overflow-x-auto rounded-md bg-stone-900 px-3 py-2 text-sm text-gray-200">
            {statusData.dockerPullCommand ||
              'docker pull ghcr.io/domigeim/agregarr:latest'}
          </code>
        </div>
      )}
      {dashboardData.tautulli?.timedOut && (
        <div className="rounded-lg bg-stone-800 p-6 shadow-sm sm:col-span-2 lg:col-span-4">
          <p className="text-sm text-orange-300">
            {intl.formatMessage(messages.tautulliTimedOut)}
          </p>
        </div>
      )}
      {isTautulliConfigured &&
        dashboardData.tautulli?.isConnected === false && (
          <div className="rounded-lg bg-stone-800 p-6 shadow-sm sm:col-span-2 lg:col-span-4">
            <p className="text-sm text-orange-300">
              {intl.formatMessage(messages.tautulliUnavailable)}
            </p>
            {dashboardData.tautulli.error && (
              <p className="mt-1 text-xs text-gray-500">
                {dashboardData.tautulli.error}
              </p>
            )}
          </div>
        )}
      {dashboardData.health && (
        <div className="rounded-lg bg-stone-800 p-6 shadow-sm sm:col-span-2 lg:col-span-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-400">
                {intl.formatMessage(messages.collectionHealth)}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {healthIssueCount === 0
                  ? intl.formatMessage(messages.healthOk)
                  : intl.formatMessage(messages.healthIssues, {
                      count: healthIssueCount,
                    })}
              </p>
            </div>
            {healthIssueCount > 0 && (
              <div className="text-sm text-gray-400">
                {dashboardData.health.totals.errors}{' '}
                {intl.formatMessage(messages.errors)} /{' '}
                {dashboardData.health.totals.warnings}{' '}
                {intl.formatMessage(messages.warnings)}
              </div>
            )}
          </div>
          {dashboardData.health.issues.length > 0 && (
            <div className="space-y-2">
              {dashboardData.health.issues.slice(0, 5).map((issue, index) => (
                <div
                  key={`${issue.area}-${index}`}
                  className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300"
                >
                  <span
                    className={
                      issue.severity === 'error'
                        ? 'font-medium text-red-300'
                        : issue.severity === 'warning'
                        ? 'font-medium text-orange-300'
                        : 'font-medium text-gray-400'
                    }
                  >
                    {issue.area}
                  </span>
                  <span className="ml-2">{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {dashboardData.sourceStatus && (
        <div className="rounded-lg bg-stone-800 p-6 shadow-sm sm:col-span-2 lg:col-span-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-400">
                {intl.formatMessage(messages.sourceStatus)}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {intl.formatMessage(messages.sourcesConfigured, {
                  configured: dashboardData.sourceStatus.configured,
                  total: dashboardData.sourceStatus.total,
                })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardData.sourceStatus.sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-md border border-gray-700 px-3 py-2 text-sm"
              >
                <span className="font-medium text-gray-200">{source.name}</span>
                <span
                  className={`flex items-center ${
                    source.configured ? 'text-green-300' : 'text-gray-500'
                  }`}
                >
                  {source.configured ? (
                    <CheckCircleIcon className="mr-1 h-4 w-4" />
                  ) : (
                    <XCircleIcon className="mr-1 h-4 w-4" />
                  )}
                  {source.configured
                    ? intl.formatMessage(messages.configured)
                    : intl.formatMessage(messages.missing)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {dashboardData.mediaServer?.capabilities && (
        <div className="rounded-lg bg-stone-800 p-6 shadow-sm sm:col-span-2 lg:col-span-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-400">
              {intl.formatMessage(messages.mediaServerCapabilities)}
            </p>
            <span className="text-sm text-gray-500">{mediaServerName}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {dashboardData.mediaServer.capabilities.map((capability) => (
              <div
                key={capability.id}
                className="rounded-md border border-gray-700 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-200">
                    {capability.label}
                  </span>
                  <span
                    className={
                      capability.available ? 'text-green-300' : 'text-gray-500'
                    }
                  >
                    {capability.available
                      ? intl.formatMessage(messages.configured)
                      : 'Plex-only'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {capability.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardStats;
