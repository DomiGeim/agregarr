import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import {
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CogIcon,
  ExclamationCircleIcon,
  RectangleStackIcon as CollectionIcon,
} from '@heroicons/react/24/outline';
import { ClockIcon, PlayIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages({
  collectionStatistics: 'Collection Statistics',
  noData: 'No collection data available',
  tautulliRequired: 'Tautulli Setup Required',
  tautulliDescriptionCollections:
    'Configure Tautulli in your settings to view detailed statistics about your collections, including play counts, watch time, and viewer activity.',
  configureTautulli: 'Configure Tautulli',
  plays: 'plays',
  hours: 'hours',
  items: 'items',
  refresh: 'Refresh',
  failedToLoadCollectionStats: 'Failed to load collection statistics',
  daysLabel: 'Days:',
  playsButton: 'Plays',
  durationButton: 'Duration',
  emptyState:
    'Create some collections and start watching to see statistics here.',
  viewerCount: '{count} {count, plural, one {viewer} other {viewers}}',
  lastUpdated: 'Last updated: {time}',
  collapseTile: 'Collapse tile',
  expandTile: 'Expand tile',
});

interface CollectionStats {
  rating_key: string;
  title: string;
  media_type: string;
  section_id: number;
  section_name: string;
  item_count: number;
  thumb?: string;
  posterUrl?: string;
  total_plays: number;
  total_duration: number;
  last_played?: number;
  play_count?: number;
  watch_time_stats: {
    query_days: number;
    total_time: number;
    total_plays: number;
  }[];
  user_stats: {
    friendly_name: string;
    user_id: number;
    total_plays: number;
    total_time: number;
  }[];
}

interface CollectionStatsResponse {
  collections: CollectionStats[];
  metadata: {
    limit: number;
    statType: string;
    days: number;
    timestamp: string;
  };
}

const CollectionStatsGrid: React.FC = () => {
  const intl = useIntl();
  const [statType, setStatType] = useState<'plays' | 'duration'>('plays');
  const [days, setDays] = useState(30);
  const [limit] = useState(8); // Increased limit for more compact view
  const [collapsed, setCollapsed] = useState(false);
  const collapseStorageKey =
    'agregarr-dashboard-section-collapsed-collection-statistics';

  const {
    data: collectionStats,
    error,
    mutate,
  } = useSWR<CollectionStatsResponse>(
    `/api/v1/dashboard/collections?limit=${limit}&statType=${statType}&days=${days}`
  );

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    return hours > 0
      ? `${hours} ${intl.formatMessage(messages.hours)}`
      : '< 1 hour';
  };

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(collapseStorageKey) === 'on');
    } catch {
      setCollapsed(false);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(collapseStorageKey, next ? 'on' : 'off');
      } catch {
        // Ignore localStorage write failures in private browsing contexts.
      }
      return next;
    });
  };

  const collapseButton = (
    <button
      type="button"
      aria-label={intl.formatMessage(
        collapsed ? messages.expandTile : messages.collapseTile
      )}
      className="text-gray-500 transition hover:text-gray-200"
      onClick={toggleCollapsed}
    >
      {collapsed ? (
        <ChevronDownIcon className="h-5 w-5" />
      ) : (
        <ChevronUpIcon className="h-5 w-5" />
      )}
    </button>
  );

  if (error) {
    // Check if it's a Tautulli configuration error
    const isTautulliError =
      error.message.includes('Tautulli not configured') ||
      error.message.includes('Tautulli settings');

    if (isTautulliError) {
      return (
        <div className="rounded-lg bg-stone-800 shadow-sm">
          <div className="border-b border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center text-lg font-medium text-white">
                <ChartBarIcon className="mr-2 h-5 w-5 text-orange-400" />
                {intl.formatMessage(messages.collectionStatistics)}
              </h3>
              {collapseButton}
            </div>
          </div>
          {!collapsed && (
            <div className="p-6">
              <div className="flex flex-col items-center py-8 text-center">
                <ExclamationCircleIcon className="mb-4 h-12 w-12 text-orange-400" />
                <h4 className="mb-2 text-lg font-semibold text-white">
                  {intl.formatMessage(messages.tautulliRequired)}
                </h4>
                <p className="mb-6 max-w-md text-gray-400">
                  {intl.formatMessage(messages.tautulliDescriptionCollections)}
                </p>
                <Link href="/settings/sources" passHref>
                  <Button as="a" buttonType="primary">
                    <CogIcon className="mr-2 h-5 w-5" />
                    {intl.formatMessage(messages.configureTautulli)}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      );
    }

    // For other errors, show generic error message
    return (
      <div className="rounded-lg bg-stone-800 shadow-sm">
        <div className="border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center text-lg font-medium text-white">
              <ChartBarIcon className="mr-2 h-5 w-5 text-orange-400" />
              {intl.formatMessage(messages.collectionStatistics)}
            </h3>
            {collapseButton}
          </div>
        </div>
        {!collapsed && (
          <div className="p-6 text-center">
            <p className="mb-2 text-red-400">
              {intl.formatMessage(messages.failedToLoadCollectionStats)}
            </p>
            <p className="text-sm text-gray-400">{error.message}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-stone-800 shadow-sm">
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center text-lg font-medium text-white">
            <ChartBarIcon className="mr-2 h-5 w-5 text-orange-400" />
            {intl.formatMessage(messages.collectionStatistics)}
          </h3>
          <div className="flex items-center space-x-3">
            {/* Days input */}
            {!collapsed && (
              <div className="flex items-center space-x-2">
                <label htmlFor="days-input" className="text-sm text-gray-400">
                  {intl.formatMessage(messages.daysLabel)}
                </label>
                <input
                  id="days-input"
                  type="number"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) || 30)}
                  min="0"
                  max="9999"
                  className="w-16 rounded border border-stone-500 bg-stone-700 px-2 py-1 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="30"
                />
              </div>
            )}

            {/* Stat type buttons */}
            {!collapsed && (
              <div className="flex space-x-2">
                <Button
                  buttonSize="sm"
                  buttonType={statType === 'plays' ? 'primary' : 'default'}
                  onClick={() => setStatType('plays')}
                >
                  <PlayIcon className="mr-1 h-4 w-4" />
                  {intl.formatMessage(messages.playsButton)}
                </Button>
                <Button
                  buttonSize="sm"
                  buttonType={statType === 'duration' ? 'primary' : 'default'}
                  onClick={() => setStatType('duration')}
                >
                  <ClockIcon className="mr-1 h-4 w-4" />
                  {intl.formatMessage(messages.durationButton)}
                </Button>
              </div>
            )}
            {collapseButton}
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="p-6">
          {!collectionStats ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : collectionStats.collections.length === 0 ? (
            <div className="py-8 text-center">
              <CollectionIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-gray-400">
                {intl.formatMessage(messages.noData)}
              </p>
              <p className="text-sm text-gray-500">
                {intl.formatMessage(messages.emptyState)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {collectionStats.collections.map((collection) => (
                <div
                  key={collection.rating_key}
                  className="flex items-center space-x-3 rounded-lg border border-gray-700 p-3 transition-colors hover:border-gray-600"
                >
                  <div className="flex-shrink-0">
                    {collection.posterUrl ? (
                      <div className="relative">
                        <img
                          src={collection.posterUrl}
                          alt={collection.title}
                          className="h-16 w-11 rounded border border-gray-600 object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const iconDiv = e.currentTarget
                              .nextElementSibling as HTMLElement;
                            if (iconDiv) iconDiv.style.display = 'flex';
                          }}
                        />
                        <div className="hidden h-16 w-11 items-center justify-center rounded border border-gray-700 bg-stone-900">
                          <CollectionIcon className="h-8 w-8 text-orange-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-16 w-11 items-center justify-center rounded border border-gray-700 bg-stone-900">
                        <CollectionIcon className="h-8 w-8 text-orange-400" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {collection.title}
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <span>
                        {collection.item_count}{' '}
                        {intl.formatMessage(messages.items)}
                      </span>
                      <span>•</span>
                      <div className="flex items-center">
                        <PlayIcon className="mr-1 h-3 w-3" />
                        {collection.total_plays}{' '}
                        {intl.formatMessage(messages.plays)}
                      </div>
                      <span>•</span>
                      <div className="flex items-center">
                        <ClockIcon className="mr-1 h-3 w-3" />
                        {formatDuration(collection.total_duration)}
                      </div>
                      {collection.user_stats.length > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            {intl.formatMessage(messages.viewerCount, {
                              count: collection.user_stats.length,
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-xl font-bold text-white">
                      {statType === 'plays'
                        ? collection.total_plays
                        : Math.floor(collection.total_duration / 3600)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {statType === 'plays' ? 'plays' : 'hours'}
                    </div>
                  </div>
                </div>
              ))}

              {collectionStats.collections.length > 0 && (
                <div className="mt-3 border-t border-gray-700 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {intl.formatMessage(messages.lastUpdated, {
                        time: new Date(
                          collectionStats.metadata.timestamp
                        ).toLocaleString(),
                      })}
                    </p>
                    <Button
                      buttonSize="sm"
                      buttonType="ghost"
                      onClick={() => mutate()}
                    >
                      {intl.formatMessage(messages.refresh)}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CollectionStatsGrid;
