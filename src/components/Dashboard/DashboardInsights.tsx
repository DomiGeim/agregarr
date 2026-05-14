import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  ServerStackIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import type React from 'react';
import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages({
  title: 'Operational Intelligence',
  subtitle: 'Practical checks and previews before you run bigger changes.',
  healthScore: 'Collection Health Scores',
  sourceMonitor: 'Source Monitor',
  actionCenter: 'Action Center',
  collectionTimeline: 'Collection Timeline',
  changelog: "What's New",
  heatScores: 'Tautulli Heat Scores',
  autoSnooze: 'Auto-Snooze Candidates',
  sourceReliability: 'Source Reliability',
  placeholderLifecycle: 'Placeholder Lifecycle',
  explainNumbers: 'Explain This Number',
  operationsSuite: 'Operations Suite',
  recommendations: 'Smart Recommendations',
  syncDryRun: 'Sync Dry Run',
  cleanupPreview: 'Cleanup Preview',
  tautulliTrends: 'Tautulli Trends',
  noRecommendations: 'No recommendations right now.',
  loading: 'Loading intelligence data...',
  failedToLoadInsights: 'Failed to load intelligence data',
  collectionsToSync: '{count} collections would be checked',
  changedCollections: '{count} changed collections',
  collectionsWithErrors: '{count} known sync errors',
  autoRequestEnabled: '{count} collections can process missing media',
  placeholders: '{count} tracked placeholders',
  stalePlaceholders: '{count} older than 30 days',
  pendingRequests: '{count} open or failed requests',
  weeklyTrend: '{current} plays this week ({delta} vs previous week)',
  configured: 'Configured',
  missing: 'Missing',
  usedByCollections: '{count} collections',
  releaseHighlights: 'Release highlights for {version}',
  noTimeline: 'No recent collection activity found.',
  noActionItems: 'No action items right now.',
  heatScore: 'heat',
  snoozeRecommendation: 'Recommendation: {recommendation}',
  placeholderAge: '{days} days old',
  moduleReady: 'Ready',
  moduleWatch: 'Watch',
  moduleAttention: 'Attention',
  open: 'Open',
  searchOperations: 'Search operations',
  allOperationStatuses: 'All statuses',
  maintenanceMode: 'Maintenance Mode',
  maintenanceOn: 'Maintenance active',
  maintenanceOff: 'Maintenance off',
  enableMaintenance: 'Enable maintenance',
  disableMaintenance: 'Disable maintenance',
  sourceTests: 'Source Test Center',
  testSource: 'Test',
  runAction: 'Run',
  downloadDiagnostics: 'Download diagnostics',
  downloadBackup: 'Download backup',
  actionSucceeded: 'Action completed.',
  actionFailed: 'Action failed.',
});

interface DashboardInsightData {
  collectionHealthScores?: {
    id: string;
    name: string;
    type: string;
    libraryName?: string;
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    reasons: string[];
  }[];
  recommendations?: {
    id: string;
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  previews?: {
    syncDryRun: {
      collectionsToSync: number;
      changedCollections: {
        id: string;
        name: string;
        type: string;
        libraryName?: string;
      }[];
      collectionsWithErrors: number;
      autoRequestEnabled: number;
      estimatedActions: string[];
    };
    cleanupPreview: {
      placeholderCount: number;
      stalePlaceholderCount: number;
      pendingRequestCount: number;
      notes: string[];
    };
  };
  trends?: {
    currentWeekPlays: number;
    previousWeekPlays: number;
    delta: number;
    deltaPercent: number;
    topMovies: { title: string; plays: number }[];
    topTv: { title: string; plays: number }[];
  } | null;
  sourceStatus?: {
    sources: {
      id: string;
      name: string;
      configured: boolean;
      status: 'configured' | 'missing';
      usedByCollections: number;
    }[];
  };
  intelligence?: {
    actionCenter: {
      id: string;
      title: string;
      message: string;
      priority: 'high' | 'medium' | 'low';
      href: string;
      actionLabel: string;
    }[];
    collectionTimeline: {
      id: string;
      type: string;
      title: string;
      message: string;
      at: string;
    }[];
    changelog: {
      version: string;
      highlights: string[];
    };
    heatScores: {
      title: string;
      mediaType: string;
      plays: number;
      heatScore: number;
    }[];
    autoSnoozeCandidates: {
      id: string;
      name: string;
      score: number;
      reason: string;
      recommendation: string;
    }[];
    sourceReliability: {
      id: string;
      name: string;
      score: number;
      status: 'ok' | 'watch' | 'attention';
      message: string;
      lastLatencyMs?: number;
      lastTestedAt?: string;
    }[];
    sourceTests?: {
      id: string;
      name: string;
      configured: boolean;
      ok: boolean;
      latencyMs: number;
      testedAt: string;
      message: string;
      error?: string;
    }[];
    placeholderLifecycle: {
      total: number;
      items: {
        id: number;
        title: string;
        mediaType: string;
        source: string;
        configId: string;
        ageDays: number;
        hasPlexRatingKey: boolean;
      }[];
    };
    explainers: {
      id: string;
      label: string;
      explanation: string;
      source: string;
      updatedAt: string;
    }[];
    operationsSuite: {
      id: string;
      number: number;
      title: string;
      category: string;
      status: 'ready' | 'watch' | 'attention';
      metric: string;
      summary: string;
      href: string;
    }[];
    availableActions?: {
      id: string;
      title: string;
      danger?: boolean;
    }[];
  };
  maintenanceMode?: {
    enabled: boolean;
    syncRunning: boolean;
  };
}

const scoreColor = (status: string): string => {
  switch (status) {
    case 'critical':
      return 'border-red-500/50 text-red-300';
    case 'warning':
      return 'border-orange-500/50 text-orange-300';
    default:
      return 'border-green-500/40 text-green-300';
  }
};

const priorityColor = (priority: string): string => {
  switch (priority) {
    case 'high':
      return 'text-red-300';
    case 'medium':
      return 'text-orange-300';
    default:
      return 'text-gray-300';
  }
};

const operationStatusClass = (status: string): string => {
  switch (status) {
    case 'attention':
      return 'border-red-500/40 text-red-300';
    case 'watch':
      return 'border-orange-500/40 text-orange-300';
    default:
      return 'border-green-500/40 text-green-300';
  }
};

const DashboardInsights: React.FC = () => {
  const intl = useIntl();
  const { data, error } = useSWR<DashboardInsightData>(
    '/api/v1/dashboard/stats'
  );
  const [operationQuery, setOperationQuery] = useState('');
  const [operationStatus, setOperationStatus] = useState('all');
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const filteredOperations = useMemo(() => {
    const query = operationQuery.trim().toLowerCase();

    return (data?.intelligence?.operationsSuite || []).filter((operation) => {
      const matchesStatus =
        operationStatus === 'all' || operation.status === operationStatus;
      const matchesQuery =
        !query ||
        operation.title.toLowerCase().includes(query) ||
        operation.category.toLowerCase().includes(query) ||
        operation.summary.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [data?.intelligence?.operationsSuite, operationQuery, operationStatus]);
  const runDashboardAction = async (actionId: string) => {
    setRunningAction(actionId);
    setActionMessage(null);

    try {
      const response = await axios.post(
        `/api/v1/dashboard/actions/${actionId}`
      );

      if (response.data?.url) {
        window.location.href = response.data.url;
      }

      setActionMessage(intl.formatMessage(messages.actionSucceeded));
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const toggleMaintenanceMode = async () => {
    setRunningAction('maintenance');
    setActionMessage(null);

    try {
      await axios.post('/api/v1/dashboard/maintenance', {
        enabled: !data?.maintenanceMode?.enabled,
      });
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
      window.location.reload();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const testSource = async (sourceId: string) => {
    setRunningAction(`source-${sourceId}`);
    setActionMessage(null);

    try {
      await axios.post(`/api/v1/dashboard/source-test/${sourceId}`);
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
      window.location.reload();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
        <p className="text-sm text-red-300">
          {intl.formatMessage(messages.failedToLoadInsights)}
        </p>
        <p className="mt-1 text-xs text-gray-500">{error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg bg-stone-800 p-6 shadow-sm">
        <div className="flex items-center justify-center gap-3 py-4">
          <LoadingSpinner />
          <p className="text-sm text-gray-400">
            {intl.formatMessage(messages.loading)}
          </p>
        </div>
      </div>
    );
  }

  const topScores = data.collectionHealthScores?.slice(0, 6) || [];
  const recommendations = data.recommendations || [];
  const syncDryRun = data.previews?.syncDryRun;
  const cleanupPreview = data.previews?.cleanupPreview;
  const sourceStatus = data.sourceStatus?.sources || [];
  const intelligence = data.intelligence;

  return (
    <div className="rounded-lg bg-stone-800 shadow-sm">
      <div className="border-b border-gray-700 px-6 py-4">
        <h3 className="flex items-center text-lg font-medium text-white">
          <SparklesIcon className="mr-2 h-5 w-5 text-orange-400" />
          {intl.formatMessage(messages.title)}
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          {intl.formatMessage(messages.subtitle)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <RectangleStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.healthScore)}
          </h4>
          <div className="space-y-2">
            {topScores.map((collection) => (
              <div
                key={collection.id}
                className="rounded border border-gray-700 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {collection.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {collection.libraryName || collection.type}
                    </p>
                  </div>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-semibold ${scoreColor(
                      collection.status
                    )}`}
                  >
                    {collection.score}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-400">
                  {collection.reasons[0]}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4 lg:col-span-2">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <SparklesIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.operationsSuite)}
          </h4>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
            <input
              className="rounded border border-gray-700 bg-stone-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-orange-500"
              placeholder={intl.formatMessage(messages.searchOperations)}
              value={operationQuery}
              onChange={(event) => setOperationQuery(event.target.value)}
            />
            <select
              className="rounded border border-gray-700 bg-stone-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-orange-500"
              value={operationStatus}
              onChange={(event) => setOperationStatus(event.target.value)}
            >
              <option value="all">
                {intl.formatMessage(messages.allOperationStatuses)}
              </option>
              <option value="ready">
                {intl.formatMessage(messages.moduleReady)}
              </option>
              <option value="watch">
                {intl.formatMessage(messages.moduleWatch)}
              </option>
              <option value="attention">
                {intl.formatMessage(messages.moduleAttention)}
              </option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredOperations.map((operation) => (
              <a
                key={operation.id}
                href={operation.href}
                className="rounded border border-gray-700 px-3 py-3 transition-colors hover:border-orange-500/60"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      {operation.number}. {operation.category}
                    </p>
                    <p className="line-clamp-2 mt-1 text-sm font-medium text-white">
                      {operation.title}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded border px-2 py-1 text-xs font-semibold ${operationStatusClass(
                      operation.status
                    )}`}
                  >
                    {operation.status === 'attention'
                      ? intl.formatMessage(messages.moduleAttention)
                      : operation.status === 'watch'
                      ? intl.formatMessage(messages.moduleWatch)
                      : intl.formatMessage(messages.moduleReady)}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs text-gray-400">
                  {operation.summary}
                </p>
                <p className="mt-2 truncate text-xs text-orange-300">
                  {operation.metric}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BoltIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.actionCenter)}
          </h4>
          <div className="space-y-2">
            {intelligence?.actionCenter.length ? (
              intelligence.actionCenter.map((action) => (
                <a
                  key={action.id}
                  href={action.href}
                  className="block rounded border border-gray-700 px-3 py-2 transition-colors hover:border-orange-500/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-medium ${priorityColor(
                          action.priority
                        )}`}
                      >
                        {action.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {action.message}
                      </p>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                  </div>
                </a>
              ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noActionItems)}
              </p>
            )}
          </div>
          <div className="mt-4 border-t border-gray-700 pt-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(intelligence?.availableActions || []).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={runningAction === action.id}
                  onClick={() => runDashboardAction(action.id)}
                  className={`rounded border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    action.danger
                      ? 'border-orange-500/60 text-orange-200 hover:bg-orange-500/10'
                      : 'border-gray-600 text-gray-200 hover:border-orange-500/60'
                  }`}
                >
                  {runningAction === action.id
                    ? intl.formatMessage(messages.loading)
                    : action.title}
                </button>
              ))}
              <a
                href="/api/v1/dashboard/settings-backup"
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60"
              >
                {intl.formatMessage(messages.downloadBackup)}
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded bg-stone-900 px-3 py-2">
              <span className="text-xs font-semibold text-gray-300">
                {intl.formatMessage(messages.maintenanceMode)}:{' '}
                {data.maintenanceMode?.enabled
                  ? intl.formatMessage(messages.maintenanceOn)
                  : intl.formatMessage(messages.maintenanceOff)}
              </span>
              <button
                type="button"
                disabled={runningAction === 'maintenance'}
                onClick={toggleMaintenanceMode}
                className="rounded border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {data.maintenanceMode?.enabled
                  ? intl.formatMessage(messages.disableMaintenance)
                  : intl.formatMessage(messages.enableMaintenance)}
              </button>
            </div>
            {actionMessage && (
              <p className="mt-2 text-xs text-gray-400">{actionMessage}</p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ClockIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.collectionTimeline)}
          </h4>
          <div className="space-y-2">
            {intelligence?.collectionTimeline.length ? (
              intelligence.collectionTimeline.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="rounded border border-gray-700 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">
                      {event.title}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(event.at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    {event.message}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noTimeline)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <LightBulbIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.recommendations)}
          </h4>
          <div className="space-y-2">
            {recommendations.length === 0 ? (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noRecommendations)}
              </p>
            ) : (
              recommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className="rounded border border-gray-700 px-3 py-2"
                >
                  <p
                    className={`text-sm font-medium ${priorityColor(
                      recommendation.priority
                    )}`}
                  >
                    {recommendation.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {recommendation.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BeakerIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.syncDryRun)}
          </h4>
          {syncDryRun && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {intl.formatMessage(messages.collectionsToSync, {
                  count: syncDryRun.collectionsToSync,
                })}
              </p>
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {intl.formatMessage(messages.changedCollections, {
                  count: syncDryRun.changedCollections.length,
                })}
              </p>
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {intl.formatMessage(messages.collectionsWithErrors, {
                  count: syncDryRun.collectionsWithErrors,
                })}
              </p>
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {intl.formatMessage(messages.autoRequestEnabled, {
                  count: syncDryRun.autoRequestEnabled,
                })}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <SparklesIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.changelog)}
          </h4>
          {intelligence?.changelog && (
            <div>
              <p className="mb-3 text-sm text-gray-300">
                {intl.formatMessage(messages.releaseHighlights, {
                  version: intelligence.changelog.version,
                })}
              </p>
              <div className="space-y-2">
                {intelligence.changelog.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300"
                  >
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <TrashIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.cleanupPreview)}
          </h4>
          {cleanupPreview && (
            <div className="space-y-2">
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {intl.formatMessage(messages.placeholders, {
                  count: cleanupPreview.placeholderCount,
                })}
              </p>
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {intl.formatMessage(messages.stalePlaceholders, {
                  count: cleanupPreview.stalePlaceholderCount,
                })}
              </p>
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {intl.formatMessage(messages.pendingRequests, {
                  count: cleanupPreview.pendingRequestCount,
                })}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.heatScores)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.heatScores || []).slice(0, 6).map((item) => (
              <div
                key={`${item.mediaType}-${item.title}`}
                className="flex items-center justify-between rounded bg-stone-900 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-gray-200">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {item.mediaType} / {item.plays} plays
                  </p>
                </div>
                <span className="rounded border border-orange-500/50 px-2 py-1 text-xs font-semibold text-orange-300">
                  {item.heatScore} {intl.formatMessage(messages.heatScore)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <TrashIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.autoSnooze)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.autoSnoozeCandidates || [])
              .slice(0, 5)
              .map((candidate) => (
                <div
                  key={candidate.id}
                  className="rounded border border-gray-700 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">
                      {candidate.name}
                    </p>
                    <span className="text-xs text-orange-300">
                      {candidate.score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {candidate.reason}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {intl.formatMessage(messages.snoozeRecommendation, {
                      recommendation: candidate.recommendation,
                    })}
                  </p>
                </div>
              ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.sourceReliability)}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(intelligence?.sourceReliability || []).map((source) => (
              <div key={source.id} className="rounded bg-stone-900 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-200">
                    {source.name}
                  </p>
                  <span
                    className={`text-xs font-semibold ${
                      source.status === 'ok'
                        ? 'text-green-300'
                        : source.status === 'watch'
                        ? 'text-orange-300'
                        : 'text-red-300'
                    }`}
                  >
                    {source.score}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{source.message}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <RectangleStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.placeholderLifecycle)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.placeholderLifecycle.items || [])
              .slice(0, 6)
              .map((placeholder) => (
                <div
                  key={placeholder.id}
                  className="flex items-center justify-between gap-3 rounded bg-stone-900 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-gray-200">
                      {placeholder.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {placeholder.source} / {placeholder.mediaType}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {intl.formatMessage(messages.placeholderAge, {
                      days: placeholder.ageDays,
                    })}
                  </span>
                </div>
              ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.tautulliTrends)}
          </h4>
          {data.trends ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                {intl.formatMessage(messages.weeklyTrend, {
                  current: data.trends.currentWeekPlays,
                  delta: `${data.trends.delta >= 0 ? '+' : ''}${
                    data.trends.delta
                  } / ${data.trends.deltaPercent}%`,
                })}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[...data.trends.topMovies, ...data.trends.topTv]
                  .slice(0, 6)
                  .map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="flex items-center justify-between rounded bg-stone-900 px-3 py-2 text-xs"
                    >
                      <span className="truncate text-gray-300">
                        {item.title}
                      </span>
                      <span className="ml-2 text-orange-300">{item.plays}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Tautulli trend data unavailable.
            </p>
          )}
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.sourceMonitor)}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sourceStatus.map((source) => (
              <div
                key={source.id}
                className="rounded bg-stone-900 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-200">{source.name}</p>
                    <p className="text-xs text-gray-500">
                      {intl.formatMessage(messages.usedByCollections, {
                        count: source.usedByCollections || 0,
                      })}
                    </p>
                  </div>
                  <span
                    className={
                      source.configured ? 'text-green-300' : 'text-gray-500'
                    }
                  >
                    {source.configured ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5" />
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={runningAction === `source-${source.id}`}
                  onClick={() => testSource(source.id)}
                  className="mt-2 rounded border border-gray-600 px-2 py-1 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {intl.formatMessage(messages.testSource)}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BeakerIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.sourceTests)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.sourceTests || []).slice(0, 6).map((test) => (
              <div key={test.id} className="rounded bg-stone-900 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-200">
                    {test.name}
                  </p>
                  <span
                    className={`text-xs font-semibold ${
                      test.ok ? 'text-green-300' : 'text-red-300'
                    }`}
                  >
                    {test.latencyMs} ms
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {test.error || test.message}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4 lg:col-span-2">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <QuestionMarkCircleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.explainNumbers)}
          </h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(intelligence?.explainers || []).map((explainer) => (
              <div
                key={explainer.id}
                className="rounded border border-gray-700 px-3 py-2"
              >
                <p className="text-sm font-medium text-white">
                  {explainer.label}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {explainer.explanation}
                </p>
                <p className="mt-2 text-xs text-gray-500">{explainer.source}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardInsights;
