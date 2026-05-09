import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import {
  CogIcon,
  ExclamationCircleIcon,
  FilmIcon,
  PlayIcon,
  RectangleStackIcon as CollectionIcon,
  ServerStackIcon,
  TvIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import type React from 'react';
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
  mediaServer: 'Media Server',
  libraries: 'libraries',
  active: 'active',
});

interface DashboardData {
  mediaServer?: {
    activeType: 'plex' | 'jellyfin';
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
    };
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
    error?: string;
    timedOut?: boolean;
    weeklyActivity?: {
      totalPlays: number;
      moviePlays: number;
      tvPlays: number;
      collectionPlays: number;
    };
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
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
}) => (
  <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-400">{title}</p>
        <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex-shrink-0">
        <Icon className="h-8 w-8 text-orange-400" />
      </div>
    </div>
  </div>
);

const DashboardStats: React.FC = () => {
  const intl = useIntl();
  const { data: dashboardData, error } = useSWR<DashboardData>(
    '/api/v1/dashboard/stats'
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

  // Check if Tautulli is not configured
  const isTautulliConfigured =
    dashboardData.tautulli?.configured === true ||
    dashboardData.tautulli?.isConnected === true ||
    dashboardData.activity !== null;

  // If Tautulli is not configured, show setup message
  if (!isTautulliConfigured) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={intl.formatMessage(messages.mediaServer)}
            value={
              dashboardData.mediaServer?.activeType === 'jellyfin'
                ? 'Jellyfin'
                : 'Plex'
            }
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
  const healthIssueCount =
    (dashboardData.health?.totals.errors || 0) +
    (dashboardData.health?.totals.warnings || 0) +
    (dashboardData.health?.totals.info || 0);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={intl.formatMessage(messages.mediaServer)}
        value={
          dashboardData.mediaServer?.activeType === 'jellyfin'
            ? 'Jellyfin'
            : 'Plex'
        }
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
      <StatCard
        title={intl.formatMessage(messages.collectionPlays)}
        value={collectionPlays}
        icon={PlayIcon}
        subtitle={`${totalPlays} ${intl.formatMessage(
          messages.totalServer
        )} • ${intl.formatMessage(messages.thisWeek)}`}
      />
      <StatCard
        title={intl.formatMessage(messages.movieCollectionPlays)}
        value={movieCollectionPlays}
        icon={FilmIcon}
        subtitle={`${totalMoviePlays} ${intl.formatMessage(
          messages.totalServer
        )} • ${intl.formatMessage(messages.thisWeek)}`}
      />
      <StatCard
        title={intl.formatMessage(messages.tvCollectionPlays)}
        value={tvCollectionPlays}
        icon={TvIcon}
        subtitle={`${totalTvPlays} ${intl.formatMessage(
          messages.totalServer
        )} • ${intl.formatMessage(messages.thisWeek)}`}
      />
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
    </div>
  );
};

export default DashboardStats;
