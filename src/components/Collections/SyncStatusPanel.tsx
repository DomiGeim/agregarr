import Spinner from '@app/assets/spinner.svg';
import Button from '@app/components/Common/Button';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { useRouter } from 'next/router';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages({
  title: 'Collection Sync Status',
  running: 'Running',
  idle: 'Idle',
  starting: 'Starting sync...',
  syncing: 'Syncing...',
  pending:
    '{count, plural, one {# collection pending} other {# collections pending}}',
  upToDate: 'All collections are up to date',
  progress: '{processed} / {total} collections',
  lastSyncLabel: 'Last sync',
  nextSyncLabel: 'Next sync',
  noSyncYet: 'No sync yet',
  overdue: 'Overdue',
  soon: 'Soon',
  justNow: 'Just now',
  minutesAgo: '{count, plural, one {# minute ago} other {# minutes ago}}',
  hoursAgo: '{count, plural, one {# hour ago} other {# hours ago}}',
  daysAgo: '{count, plural, one {# day ago} other {# days ago}}',
  inMinutes: 'in {count, plural, one {# minute} other {# minutes}}',
  inHours: 'in {count, plural, one {# hour} other {# hours}}',
  inHoursMinutes:
    'in {hours, plural, one {# hour} other {# hours}} {minutes, plural, one {# minute} other {# minutes}}',
  inDays: 'in {count, plural, one {# day} other {# days}}',
  startSync: 'Start sync',
  cancelSync: 'Cancel sync',
  jobs: 'Jobs',
  started: 'Collection sync started.',
  startFailed: 'Failed to start collection sync.',
  cancelled: 'Collection sync cancellation requested.',
  cancelFailed: 'Failed to cancel collection sync.',
  lastSyncFailed: 'Last sync failed',
});

interface SyncStatusResponse {
  running: boolean;
  currentStage?: string;
  totalCollections?: number;
  processedCollections?: number;
  progress?: number;
  lastGlobalSyncAt?: string;
  globalSyncError?: string;
  collectionsNeedingSync: number;
  nextSyncAt?: string;
}

interface SyncStatusPanelProps {
  compact?: boolean;
  showControls?: boolean;
  onSyncComplete?: () => void;
}

const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({
  compact = false,
  showControls = true,
  onSyncComplete,
}) => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const prevRunningRef = useRef<boolean>();

  const { data: syncStatus, mutate } = useSWR<SyncStatusResponse>(
    '/api/v1/collections/sync/status',
    (url: string) => axios.get(url).then((res) => res.data),
    {
      refreshInterval: (data) => (data?.running ? 1000 : 5000),
    }
  );

  const formatRelativeTime = useCallback(
    (timestamp?: string) => {
      if (!timestamp) {
        return intl.formatMessage(messages.noSyncYet);
      }

      const diffInMs = Date.now() - new Date(timestamp).getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 1) {
        return intl.formatMessage(messages.justNow);
      }
      if (diffInMinutes < 60) {
        return intl.formatMessage(messages.minutesAgo, {
          count: diffInMinutes,
        });
      }
      if (diffInHours < 24) {
        return intl.formatMessage(messages.hoursAgo, { count: diffInHours });
      }
      return intl.formatMessage(messages.daysAgo, { count: diffInDays });
    },
    [intl]
  );

  const formatFutureTime = useCallback(
    (timestamp?: string) => {
      if (!timestamp) {
        return '-';
      }

      const diffInMs = new Date(timestamp).getTime() - Date.now();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const remainingMinutes = diffInMinutes % 60;
      const diffInHours =
        remainingMinutes >= 30
          ? Math.ceil(diffInMinutes / 60)
          : Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMs < 0) {
        return intl.formatMessage(messages.overdue);
      }
      if (diffInMinutes < 1) {
        return intl.formatMessage(messages.soon);
      }
      if (diffInMinutes < 60) {
        return intl.formatMessage(messages.inMinutes, {
          count: diffInMinutes,
        });
      }
      if (diffInHours < 24) {
        const exactHours = Math.floor(diffInMinutes / 60);
        if (exactHours < 2 && remainingMinutes > 0) {
          return intl.formatMessage(messages.inHoursMinutes, {
            hours: exactHours,
            minutes: remainingMinutes,
          });
        }
        return intl.formatMessage(messages.inHours, { count: diffInHours });
      }
      return intl.formatMessage(messages.inDays, { count: diffInDays });
    },
    [intl]
  );

  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    const isRunning = syncStatus?.running;

    if (wasRunning === true && isRunning === false) {
      onSyncComplete?.();
    }

    prevRunningRef.current = isRunning;
  }, [onSyncComplete, syncStatus?.running]);

  const startSync = async () => {
    setIsStarting(true);
    try {
      await axios.post('/api/v1/collections/sync');
      await mutate();
      addToast(intl.formatMessage(messages.started), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.startFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsStarting(false);
    }
  };

  const cancelSync = async () => {
    setIsCancelling(true);
    try {
      await axios.post('/api/v1/settings/jobs/plex-collections-sync/cancel');
      await mutate();
      addToast(intl.formatMessage(messages.cancelled), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.cancelFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (!syncStatus) {
    return null;
  }

  const progress =
    syncStatus.progress ??
    (syncStatus.totalCollections && syncStatus.totalCollections > 0
      ? Math.round(
          ((syncStatus.processedCollections ?? 0) /
            syncStatus.totalCollections) *
            100
        )
      : 0);
  const statusColor = syncStatus.running
    ? 'text-orange-300'
    : syncStatus.globalSyncError
    ? 'text-red-300'
    : 'text-green-300';
  const StatusIcon = syncStatus.running
    ? ArrowPathIcon
    : syncStatus.globalSyncError
    ? ExclamationTriangleIcon
    : CheckCircleIcon;

  return (
    <section
      className={`rounded-lg border border-gray-700 bg-stone-900/70 shadow-sm ${
        compact ? 'p-4' : 'p-4 sm:p-5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-white sm:text-lg">
              {intl.formatMessage(messages.title)}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-xs font-semibold ${statusColor}`}
            >
              <StatusIcon
                className={`h-4 w-4 ${
                  syncStatus.running ? 'animate-spin' : ''
                }`}
              />
              {syncStatus.running
                ? intl.formatMessage(messages.running)
                : intl.formatMessage(messages.idle)}
            </span>
          </div>

          <p className="mt-2 break-words text-sm text-gray-300 sm:truncate">
            {isStarting && !syncStatus.running
              ? intl.formatMessage(messages.starting)
              : syncStatus.running
              ? syncStatus.currentStage || intl.formatMessage(messages.syncing)
              : syncStatus.globalSyncError
              ? intl.formatMessage(messages.lastSyncFailed)
              : syncStatus.collectionsNeedingSync > 0
              ? intl.formatMessage(messages.pending, {
                  count: syncStatus.collectionsNeedingSync,
                })
              : syncStatus.lastGlobalSyncAt
              ? intl.formatMessage(messages.upToDate)
              : intl.formatMessage(messages.noSyncYet)}
          </p>
        </div>

        {showControls && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            {syncStatus.running ? (
              <Button
                buttonType="danger"
                onClick={cancelSync}
                disabled={isCancelling}
                className="flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                {isCancelling ? (
                  <Spinner className="h-4 w-4 animate-spin" />
                ) : (
                  <StopIcon className="h-4 w-4" />
                )}
                <span>{intl.formatMessage(messages.cancelSync)}</span>
              </Button>
            ) : (
              <Button
                buttonType="primary"
                onClick={startSync}
                disabled={isStarting}
                className="flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                {isStarting ? (
                  <Spinner className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowPathIcon className="h-4 w-4" />
                )}
                <span>{intl.formatMessage(messages.startSync)}</span>
              </Button>
            )}
            <Button
              buttonType="default"
              onClick={() => router.push('/settings/jobs')}
              className="w-full justify-center sm:w-auto"
            >
              {intl.formatMessage(messages.jobs)}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-400">
          <span>
            {intl.formatMessage(messages.progress, {
              processed: syncStatus.processedCollections ?? 0,
              total: syncStatus.totalCollections ?? 0,
            })}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-700">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="flex min-w-0 items-center gap-2 text-gray-400">
          <ClockIcon className="h-4 w-4 text-gray-500" />
          <span>
            {intl.formatMessage(messages.lastSyncLabel)}:{' '}
            <span className="text-gray-200">
              {formatRelativeTime(syncStatus.lastGlobalSyncAt)}
            </span>
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-gray-400">
          <ClockIcon className="h-4 w-4 text-gray-500" />
          <span>
            {intl.formatMessage(messages.nextSyncLabel)}:{' '}
            <span className="text-gray-200">
              {formatFutureTime(syncStatus.nextSyncAt)}
            </span>
          </span>
        </div>
        {syncStatus.globalSyncError && (
          <div
            className="truncate text-red-300"
            title={syncStatus.globalSyncError}
          >
            {syncStatus.globalSyncError}
          </div>
        )}
      </div>
    </section>
  );
};

export default SyncStatusPanel;
