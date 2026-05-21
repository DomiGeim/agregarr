import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  ExclamationTriangleIcon,
  FilmIcon,
  PlusCircleIcon,
  TvIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import type React from 'react';
import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import useSWR from 'swr';
import MissingItemsModal from './MissingItemsModal';

const messages = defineMessages({
  recentlyAddedMissing: 'Recently Added from Tautulli',
  movies: 'Movies',
  tvShows: 'TV Shows',
  noRecentlyAddedItems: 'No recently added items',
  noRecentActivity: 'No recently added movies or TV shows found in Tautulli',
  refresh: 'Refresh',
  viewAll: 'View All',
  requestedFrom: 'From {collection}',
  requestedVia: 'via {source}',
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusDeclined: 'Declined',
  statusAvailable: 'Available',
  statusProcessing: 'Processing',
  statusFailed: 'Failed',
  statusPartiallyAvailable: 'Partially Available',
  autoRequest: 'Auto',
  manualRequest: 'Manual',
  failedToLoadMissingItems: 'Failed to load missing items',
  failedToLoadTautulliRecentlyAdded: 'Failed to load Tautulli Recently Added',
  recentlyAddedCount: '{total} {mediaType}',
  showingRecent: 'Showing recently added items from Tautulli',
  lastUpdatedNow: 'Last updated: {time}',
  syncing: 'Syncing...',
});

interface MissingItem {
  id: number;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  year?: number;
  collectionName: string;
  collectionSource: string;
  collectionSubtype?: string;
  thumb?: string;
  posterUrl?: string;
  requestService: string;
  requestMethod: string;
  requestStatus:
    | 'pending'
    | 'approved'
    | 'declined'
    | 'available'
    | 'processing'
    | 'failed'
    | 'partially_available';
  overseerrRequestId?: number;
  requestedBy?: {
    id: number;
    displayName: string;
  };
  createdAt: string;
  requestedAt?: string;
}

interface MissingItemsResponse {
  results: MissingItem[];
  total: number;
  limit: number;
  offset: number;
}

const fetchTautulliRecentlyAdded = async (
  url: string
): Promise<MissingItemsResponse> => {
  try {
    return (await axios.get<MissingItemsResponse>(url)).data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const fallbackUrl = url.replace(
        '/api/v1/dashboard/tautulli-recently-added',
        '/api/v1/missing-items/tautulli-recently-added'
      );

      try {
        return (await axios.get<MissingItemsResponse>(fallbackUrl)).data;
      } catch (fallbackError) {
        if (
          axios.isAxiosError(fallbackError) &&
          fallbackError.response?.status === 404
        ) {
          return {
            results: [],
            total: 0,
            limit: 0,
            offset: 0,
          };
        }

        throw fallbackError;
      }
    }

    throw error;
  }
};

const MissingItemsFeed: React.FC = () => {
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies');
  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const limit = 5;
  const activeMediaType = activeTab === 'movies' ? 'movie' : 'tv';

  const {
    data: missingItemsData,
    error,
    mutate,
  } = useSWR<MissingItemsResponse>(
    `/api/v1/dashboard/tautulli-recently-added?limit=${limit}&mediaType=${activeMediaType}&offset=0`,
    fetchTautulliRecentlyAdded
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mutate();
    } catch (error) {
      await mutate();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getMediaIcon = (mediaType: string, size = 'h-5 w-5') => {
    switch (mediaType) {
      case 'movie':
        return <FilmIcon className={`${size} text-orange-400`} />;
      case 'tv':
        return <TvIcon className={`${size} text-orange-400`} />;
      default:
        return <PlayIcon className={`${size} text-gray-400`} />;
    }
  };

  const getStatusIcon = (status: string, size = 'h-4 w-4') => {
    switch (status) {
      case 'pending':
        return <ClockIcon className={`${size} text-yellow-400`} />;
      case 'approved':
        return <CheckCircleIcon className={`${size} text-green-400`} />;
      case 'declined':
        return <XCircleIcon className={`${size} text-red-400`} />;
      case 'available':
        return <CheckCircleIcon className={`${size} text-orange-400`} />;
      case 'processing':
        return <CogIcon className={`${size} animate-spin text-orange-300`} />;
      case 'failed':
        return <ExclamationTriangleIcon className={`${size} text-red-500`} />;
      case 'partially_available':
        return <CheckCircleIcon className={`${size} text-green-300`} />;
      default:
        return <ClockIcon className={`${size} text-gray-400`} />;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return intl.formatMessage(messages.statusPending);
      case 'approved':
        return intl.formatMessage(messages.statusApproved);
      case 'declined':
        return intl.formatMessage(messages.statusDeclined);
      case 'available':
        return intl.formatMessage(messages.statusAvailable);
      case 'processing':
        return intl.formatMessage(messages.statusProcessing);
      case 'failed':
        return intl.formatMessage(messages.statusFailed);
      case 'partially_available':
        return intl.formatMessage(messages.statusPartiallyAvailable);
      default:
        return status;
    }
  };

  const getCurrentItems = (): MissingItem[] => {
    if (!missingItemsData) return [];
    // Data is already filtered by activeTab on the server side
    return missingItemsData.results;
  };

  const getTmdbImageUrl = (posterPath?: string): string | undefined => {
    if (!posterPath) return undefined;
    return `https://image.tmdb.org/t/p/w154${posterPath}`;
  };

  if (error) {
    return (
      <div className="rounded-lg bg-stone-800 shadow-sm">
        <div className="border-b border-gray-700 px-6 py-4">
          <h3 className="flex items-center text-lg font-medium text-white">
            <PlusCircleIcon className="mr-2 h-5 w-5 text-orange-400" />
            {intl.formatMessage(messages.recentlyAddedMissing)}
          </h3>
        </div>
        <div className="p-6 text-center">
          <p className="mb-2 text-red-400">
            {intl.formatMessage(messages.failedToLoadTautulliRecentlyAdded)}
          </p>
          <p className="text-sm text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-stone-800 shadow-sm">
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center text-lg font-medium text-white">
            <PlusCircleIcon className="mr-2 h-5 w-5 text-orange-400" />
            {intl.formatMessage(messages.recentlyAddedMissing)}
          </h3>
          {missingItemsData && (
            <p className="flex items-center text-sm text-gray-400">
              <CalendarDaysIcon className="mr-1 h-4 w-4" />
              {intl.formatMessage(messages.recentlyAddedCount, {
                total: missingItemsData.total,
                mediaType: activeTab === 'movies' ? 'movies' : 'TV shows',
              })}
            </p>
          )}
        </div>

        {missingItemsData && (
          <div className="mt-3 flex space-x-1">
            <Button
              buttonSize="sm"
              buttonType={activeTab === 'movies' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('movies')}
            >
              <FilmIcon className="mr-1 h-4 w-4" />
              <span>{intl.formatMessage(messages.movies)}</span>
            </Button>
            <Button
              buttonSize="sm"
              buttonType={activeTab === 'tv' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('tv')}
            >
              <TvIcon className="mr-1 h-4 w-4" />
              <span>{intl.formatMessage(messages.tvShows)}</span>
            </Button>
          </div>
        )}
      </div>

      <div className="p-6">
        {!missingItemsData ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : getCurrentItems().length === 0 ? (
          <div className="py-8 text-center">
            <div className="mb-4">
              {getMediaIcon(
                activeTab === 'movies' ? 'movie' : 'tv',
                'h-12 w-12 mx-auto'
              )}
            </div>
            <p className="mb-2 text-gray-400">
              {intl.formatMessage(messages.noRecentlyAddedItems)}
            </p>
            <p className="text-sm text-gray-500">
              {intl.formatMessage(messages.noRecentActivity)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {getCurrentItems().map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex items-center space-x-3 rounded-lg border border-gray-700 p-3 transition-colors hover:border-gray-600"
              >
                <div className="flex-shrink-0">
                  {item.posterUrl || item.posterPath ? (
                    <div className="relative">
                      <img
                        src={item.posterUrl || getTmdbImageUrl(item.posterPath)}
                        alt={item.title}
                        className="h-16 w-11 rounded border border-gray-600 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const iconDiv = e.currentTarget
                            .nextElementSibling as HTMLElement;
                          if (iconDiv) iconDiv.style.display = 'flex';
                        }}
                      />
                      <div className="hidden h-16 w-11 items-center justify-center rounded border border-gray-700 bg-stone-900">
                        {getMediaIcon(item.mediaType, 'w-8 h-8')}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-16 w-11 items-center justify-center rounded border border-gray-700 bg-stone-900">
                      {getMediaIcon(item.mediaType, 'w-8 h-8')}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {item.title}
                    {item.year && (
                      <span className="ml-1 text-gray-400">({item.year})</span>
                    )}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <span>
                      {intl.formatMessage(messages.requestedFrom, {
                        collection: item.collectionName,
                      })}
                    </span>
                    <span>•</span>
                    <span>
                      {intl.formatMessage(messages.requestedVia, {
                        source: item.collectionSource,
                      })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                    <span
                      className={`rounded px-2 py-1 ${
                        item.requestMethod === 'auto'
                          ? 'bg-green-900 text-green-300'
                          : 'bg-orange-900 text-orange-300'
                      }`}
                    >
                      {item.requestMethod === 'auto'
                        ? intl.formatMessage(messages.autoRequest)
                        : intl.formatMessage(messages.manualRequest)}
                    </span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center text-sm">
                    {getStatusIcon(item.requestStatus)}
                    <span className="ml-1 text-gray-300">
                      {getStatusLabel(item.requestStatus)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {item.requestService}
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  <div>{intl.formatMessage(messages.showingRecent)}</div>
                  <div>
                    {intl.formatMessage(messages.lastUpdatedNow, {
                      time: new Date().toLocaleString(),
                    })}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    buttonSize="sm"
                    buttonType="ghost"
                    onClick={handleRefresh}
                    disabled={!missingItemsData || isRefreshing}
                  >
                    {isRefreshing
                      ? intl.formatMessage(messages.syncing)
                      : intl.formatMessage(messages.refresh)}
                  </Button>
                  <Button
                    buttonSize="sm"
                    buttonType="default"
                    onClick={() => setShowModal(true)}
                  >
                    {intl.formatMessage(messages.viewAll)}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <MissingItemsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        endpoint="/api/v1/dashboard/tautulli-recently-added"
        title={intl.formatMessage(messages.recentlyAddedMissing)}
        showFilters={false}
        showSyncButton={false}
        initialMediaType={activeMediaType}
      />
    </div>
  );
};

export default MissingItemsFeed;
