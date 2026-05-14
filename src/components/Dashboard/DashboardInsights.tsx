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
import { useEffect, useMemo, useRef, useState } from 'react';
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
  problemDetails: 'Problem Details',
  repairCenter: 'Collection Repair Center',
  tautulliDataQuality: 'Tautulli Data Quality',
  releaseStatus: 'Release Status',
  auditLog: 'Audit Log',
  sourceTestHistory: 'Source Test History',
  exportCollection: 'Export',
  releaseUpdateAvailable: 'Update available: {version}',
  installedVersion: 'Installed: {version}',
  restoreDiff: 'Restore Diff',
  matchedCollections: '{count} matched collections',
  noItems: 'No items found.',
  sourceSuccessRate: '{count}% success',
  sourceFailures: '{count} failures',
  averageLatency: '{count} ms avg',
  missingRatingKeys: '{count} missing rating keys',
  noTautulliMatch: '{count} no Tautulli match',
  firstAid: 'Run First Aid',
  backupPreview: 'Preview backup',
  collapseSection: 'Collapse',
  expandSection: 'Expand',
  repairRetrySync: 'Retry sync',
  repairRatingKey: 'Find rating key',
  repairMakeVisible: 'Make visible',
  syncDryRunDetails: 'Detailed Sync Dry Run',
  settingsConsistency: 'Settings Consistency',
  tautulliMapping: 'Tautulli Mapping Debugger',
  dashboardPerformance: 'Dashboard Performance',
  dryRunChecks: '{count} checks',
  dryRunRetries: '{count} retries',
  dryRunMissing: '{count} missing',
  dryRunPlaceholders: '{count} placeholders',
  cacheEntries: '{count} cache entries',
  restoreBackup: 'Restore backup',
  collectionDetail: 'Collection Detail',
  loadDetails: 'Load details',
  firstAidReport: 'Download First Aid report',
  runMappingAutofix: 'Run mapping auto-fix',
  notifications: 'Notifications',
  healthSnapshots: 'Health Snapshots',
  resetLayout: 'Reset layout',
  layoutPresetMinimal: 'Minimal',
  layoutPresetTautulli: 'Tautulli Debug',
  layoutPresetRepair: 'Backup & Repair',
  layoutPresetFull: 'Admin Full',
  repairQueue: 'Repair Queue',
  addToQueue: 'Queue',
  runQueue: 'Run queue',
  firstAidStatus: 'First Aid Status',
  mappingScore: 'Mapping Score',
  backupHealth: 'Backup Health',
  settingsFingerprint: 'Settings fingerprint',
  runAllSourceTests: 'Test all sources',
  releaseChanges: 'Release Changes',
  backupRecommended: 'Backup recommended',
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
    sourceTestHistory?: {
      total: number;
      failures: number;
      successRate: number;
      averageLatencyMs: number;
    };
    problemDetails?: {
      id: string;
      area: string;
      title: string;
      message: string;
      severity: 'error' | 'warning';
      action: string;
      href: string;
    }[];
    repairCandidates?: {
      id: string;
      configId: string;
      title: string;
      type: string;
      severity: 'attention' | 'watch';
      message: string;
      href: string;
    }[];
    tautulliDataQuality?: {
      configuredCollections: number;
      tautulliMatchedCollections: number;
      missingRatingKeyCount: number;
      noTautulliMatchCount: number;
      missingRatingKeys: string[];
      noTautulliMatches: string[];
      artworkCache: {
        enabled: boolean;
        strategy: string;
        candidateCount: number;
      };
    };
    tautulliMappingDebugger?: {
      id: string;
      name: string;
      type: string;
      plexRatingKey?: string;
      mapped: boolean;
      tautulliTitle?: string;
      plays: number;
      reason: string;
    }[];
    settingsConsistency?: {
      id: string;
      severity: 'error' | 'warning' | 'info';
      title: string;
      message: string;
    }[];
    detailedSyncDryRun?: {
      wouldCheckCollections: number;
      wouldRetryErrors: number;
      wouldProcessMissingItems: number;
      wouldRevisitPlaceholders: number;
      plannedChanges: {
        id: string;
        name: string;
        type: string;
        reason: string;
        href: string;
      }[];
    };
    healthSnapshots?: {
      date: string;
      at: string;
      totalCollections: number;
      criticalCollections: number;
      warningCollections: number;
      averageScore: number;
    }[];
    mappingScore?: {
      mappedCollections: number;
      totalCollections: number;
      score: number;
    };
    backupHealth?: {
      latestBackupAt?: string;
      daysSinceBackup: number | null;
      recommended: boolean;
      settingsFingerprint: string;
    };
    releaseChanges?: {
      version: string;
      highlights: string[];
    };
    notifications?: {
      id: string;
      title: string;
      message: string;
      severity: 'error' | 'warning' | 'info';
      href: string;
    }[];
    dashboardPerformance?: {
      cacheTtlMs: number;
      cacheEntries: number;
      strategy: string;
    };
    releaseStatus?: {
      installedVersion: string;
      latestVersion?: string;
      latestUrl?: string;
      updateAvailable: boolean;
      publishedAt?: string;
    };
    auditLog?: {
      id: string;
      type: string;
      title: string;
      message: string;
      at: string;
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
  const dashboardRootRef = useRef<HTMLDivElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const { data, error } = useSWR<DashboardInsightData>(
    '/api/v1/dashboard/stats'
  );
  const [operationQuery, setOperationQuery] = useState('');
  const [operationStatus, setOperationStatus] = useState('all');
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<{
    valid: boolean;
    changedSections?: {
      section: string;
      currentSize: number;
      incomingSize: number;
    }[];
    current?: { collectionCount: number; locale?: string };
    incoming?: { collectionCount: number; locale?: string };
  } | null>(null);
  const [backupPayload, setBackupPayload] = useState<unknown>(null);
  const [collectionDetail, setCollectionDetail] = useState<{
    collection: {
      id: string;
      name: string;
      type: string;
      libraryName?: string;
      collectionRatingKey?: string;
      needsSync: boolean;
      lastSyncError?: string;
    };
    health?: {
      score: number;
      status: string;
      reasons: string[];
    };
    missingItems: unknown[];
    placeholders: unknown[];
    exportUrl: string;
    diffUrl: string;
  } | null>(null);
  const [repairQueue, setRepairQueue] = useState<
    { actionId: string; configId: string; title: string }[]
  >([]);
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
  const runFirstAid = async () => {
    setRunningAction('first-aid');
    setActionMessage(null);

    try {
      const response = await axios.get('/api/v1/dashboard/first-aid');
      setActionMessage(`${response.data.status}: ${response.data.likelyCause}`);
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const runRepairAction = async (actionId: string, configId: string) => {
    setRunningAction(`${actionId}-${configId}`);
    setActionMessage(null);

    try {
      await axios.post(`/api/v1/dashboard/repair/${actionId}`, { configId });
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const previewSettingsBackup = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const backup = JSON.parse(await file.text());
      const response = await axios.post(
        '/api/v1/dashboard/settings-restore-preview',
        backup
      );
      setBackupPayload(backup);
      setBackupPreview(response.data);
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
    } catch (err) {
      setBackupPayload(null);
      setBackupPreview(null);
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      event.target.value = '';
    }
  };
  const restoreSettingsBackup = async () => {
    if (!backupPayload) {
      return;
    }

    setRunningAction('restore-backup');
    setActionMessage(null);

    try {
      await axios.post('/api/v1/settings/backup/restore', backupPayload);
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const loadCollectionDetail = async (collectionId: string) => {
    setRunningAction(`collection-detail-${collectionId}`);

    try {
      const response = await axios.get(
        `/api/v1/dashboard/collections/${collectionId}/detail`
      );
      setCollectionDetail(response.data);
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const runMappingAutoFix = async () => {
    setRunningAction('mapping-autofix');
    setActionMessage(null);

    try {
      const response = await axios.post(
        '/api/v1/dashboard/tautulli-mapping/autofix'
      );
      setActionMessage(
        `${intl.formatMessage(messages.actionSucceeded)} ${
          response.data.fixed
        }/${response.data.inspected}`
      );
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const resetLayout = () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('agregarr-dashboard-section'))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('agregarr-dashboard-section-order');
    window.location.reload();
  };
  const applyLayoutPreset = (
    preset: 'minimal' | 'tautulli' | 'repair' | 'full'
  ) => {
    const sections = Array.from(
      dashboardRootRef.current?.querySelectorAll('section h4') || []
    ).map((heading) =>
      heading.textContent
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
    );
    const visibleByPreset: Record<typeof preset, string[]> = {
      minimal: [
        'first-aid-status',
        'notifications',
        'collection-health-scores',
      ],
      tautulli: [
        'tautulli-data-quality',
        'tautulli-mapping-debugger',
        'tautulli-trends',
        'mapping-score',
      ],
      repair: [
        'collection-repair-center',
        'backup-health',
        'restore-diff',
        'detailed-sync-dry-run',
      ],
      full: sections.filter(Boolean) as string[],
    };
    const visible = visibleByPreset[preset];

    sections.forEach((sectionId) => {
      if (sectionId) {
        localStorage.setItem(
          `agregarr-dashboard-section-${sectionId}`,
          visible.includes(sectionId) ? 'expanded' : 'collapsed'
        );
      }
    });
    window.location.reload();
  };
  const addRepairToQueue = (
    actionId: string,
    configId: string,
    title: string
  ) => {
    setRepairQueue((queue) =>
      queue.some(
        (item) => item.actionId === actionId && item.configId === configId
      )
        ? queue
        : [...queue, { actionId, configId, title }]
    );
  };
  const runRepairQueue = async () => {
    setRunningAction('repair-queue');
    setActionMessage(null);

    try {
      for (const item of repairQueue) {
        await axios.post(`/api/v1/dashboard/repair/${item.actionId}`, {
          configId: item.configId,
        });
      }
      setRepairQueue([]);
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const runAllSourceTests = async () => {
    setRunningAction('source-test-all');
    setActionMessage(null);

    try {
      await axios.post('/api/v1/dashboard/source-test-all');
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };

  useEffect(() => {
    const root = dashboardRootRef.current;

    if (!root) {
      return;
    }

    const sections = Array.from(root.querySelectorAll('section'));

    sections.forEach((section) => {
      const heading = section.querySelector('h4');

      if (!heading || heading.querySelector('[data-collapse-button]')) {
        return;
      }

      const key = `agregarr-dashboard-section-${heading.textContent
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}`;
      const button = document.createElement('button');
      const upButton = document.createElement('button');
      const downButton = document.createElement('button');
      const orderKey = 'agregarr-dashboard-section-order';
      const sectionId = key.replace('agregarr-dashboard-section-', '');
      const getOrder = (): string[] =>
        JSON.parse(localStorage.getItem(orderKey) || '[]') as string[];
      const saveOrder = (order: string[]) =>
        localStorage.setItem(orderKey, JSON.stringify(order));
      const applyOrder = () => {
        const order = getOrder();

        if (!order.includes(sectionId)) {
          order.push(sectionId);
          saveOrder(order);
        }

        sections.forEach((item) => {
          const itemHeading = item.querySelector('h4');
          const itemId = itemHeading?.textContent
            ?.trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-');

          (item as HTMLElement).style.order = String(
            Math.max(0, order.indexOf(itemId || ''))
          );
        });
      };
      const applyState = (collapsed: boolean) => {
        Array.from(section.children).forEach((child) => {
          if (child !== heading) {
            (child as HTMLElement).style.display = collapsed ? 'none' : '';
          }
        });
        button.textContent = collapsed
          ? intl.formatMessage(messages.expandSection)
          : intl.formatMessage(messages.collapseSection);
      };
      const collapsed = localStorage.getItem(key) === 'collapsed';

      button.type = 'button';
      button.dataset.collapseButton = 'true';
      button.className =
        'ml-auto rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60';
      button.addEventListener('click', () => {
        const nextCollapsed = localStorage.getItem(key) !== 'collapsed';

        localStorage.setItem(key, nextCollapsed ? 'collapsed' : 'expanded');
        applyState(nextCollapsed);
      });
      upButton.type = 'button';
      upButton.textContent = '↑';
      upButton.className =
        'rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60';
      upButton.addEventListener('click', () => {
        const order = getOrder();
        const currentIndex = order.indexOf(sectionId);

        if (currentIndex > 0) {
          [order[currentIndex - 1], order[currentIndex]] = [
            order[currentIndex],
            order[currentIndex - 1],
          ];
          saveOrder(order);
          applyOrder();
        }
      });
      downButton.type = 'button';
      downButton.textContent = '↓';
      downButton.className =
        'rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60';
      downButton.addEventListener('click', () => {
        const order = getOrder();
        const currentIndex = order.indexOf(sectionId);

        if (currentIndex >= 0 && currentIndex < order.length - 1) {
          [order[currentIndex + 1], order[currentIndex]] = [
            order[currentIndex],
            order[currentIndex + 1],
          ];
          saveOrder(order);
          applyOrder();
        }
      });
      heading.classList.add('gap-2');
      heading.appendChild(upButton);
      heading.appendChild(downButton);
      heading.appendChild(button);
      applyState(collapsed);
      applyOrder();
    });
  }, [data, intl]);

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
    <div ref={dashboardRootRef} className="rounded-lg bg-stone-800 shadow-sm">
      <div className="border-b border-gray-700 px-6 py-4">
        <h3 className="flex items-center text-lg font-medium text-white">
          <SparklesIcon className="mr-2 h-5 w-5 text-orange-400" />
          {intl.formatMessage(messages.title)}
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          {intl.formatMessage(messages.subtitle)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyLayoutPreset('minimal')}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.layoutPresetMinimal)}
          </button>
          <button
            type="button"
            onClick={() => applyLayoutPreset('tautulli')}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.layoutPresetTautulli)}
          </button>
          <button
            type="button"
            onClick={() => applyLayoutPreset('repair')}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.layoutPresetRepair)}
          </button>
          <button
            type="button"
            onClick={() => applyLayoutPreset('full')}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.layoutPresetFull)}
          </button>
          <button
            type="button"
            onClick={resetLayout}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.resetLayout)}
          </button>
        </div>
      </div>

      {data.maintenanceMode?.enabled && (
        <div className="border-b border-orange-500/30 bg-orange-500/10 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-orange-100">
              {intl.formatMessage(messages.maintenanceOn)}
            </p>
            <button
              type="button"
              disabled={runningAction === 'maintenance'}
              onClick={toggleMaintenanceMode}
              className="rounded border border-orange-400/60 px-3 py-1.5 text-xs font-semibold text-orange-100 transition-colors hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {intl.formatMessage(messages.disableMaintenance)}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
        <section className="rounded-md border border-gray-700 p-4 lg:col-span-2">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <CheckCircleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.firstAidStatus)}
          </h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded bg-stone-900 px-3 py-2">
              <p className="text-xs text-gray-500">
                {intl.formatMessage(messages.mappingScore)}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {intelligence?.mappingScore?.score || 0}%
              </p>
            </div>
            <div className="rounded bg-stone-900 px-3 py-2">
              <p className="text-xs text-gray-500">
                {intl.formatMessage(messages.backupHealth)}
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  intelligence?.backupHealth?.recommended
                    ? 'text-orange-300'
                    : 'text-green-300'
                }`}
              >
                {intelligence?.backupHealth?.recommended
                  ? intl.formatMessage(messages.backupRecommended)
                  : intl.formatMessage(messages.moduleReady)}
              </p>
            </div>
            <div className="rounded bg-stone-900 px-3 py-2">
              <p className="text-xs text-gray-500">
                {intl.formatMessage(messages.settingsFingerprint)}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-200">
                {intelligence?.backupHealth?.settingsFingerprint || '-'}
              </p>
            </div>
          </div>
        </section>

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
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={`/api/v1/dashboard/collection-diff/${collection.id}`}
                    className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                  >
                    {intl.formatMessage(messages.problemDetails)}
                  </a>
                  <a
                    href={`/api/v1/dashboard/collections/${collection.id}/export`}
                    className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                  >
                    {intl.formatMessage(messages.exportCollection)}
                  </a>
                  <button
                    type="button"
                    onClick={() => loadCollectionDetail(collection.id)}
                    className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                  >
                    {intl.formatMessage(messages.loadDetails)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {collectionDetail && (
          <section className="rounded-md border border-gray-700 p-4">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
              <RectangleStackIcon className="mr-2 h-4 w-4 text-orange-400" />
              {intl.formatMessage(messages.collectionDetail)}
            </h4>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">
                {collectionDetail.collection.name}
              </p>
              <p className="text-xs text-gray-400">
                {collectionDetail.collection.type} /{' '}
                {collectionDetail.collection.libraryName || 'library'}
              </p>
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
                {collectionDetail.health?.score || 0} /{' '}
                {collectionDetail.health?.status || 'unknown'}
              </p>
              <p className="text-xs text-gray-500">
                {collectionDetail.health?.reasons?.join(', ') ||
                  intl.formatMessage(messages.noItems)}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={collectionDetail.diffUrl}
                  className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                >
                  {intl.formatMessage(messages.problemDetails)}
                </a>
                <a
                  href={collectionDetail.exportUrl}
                  className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                >
                  {intl.formatMessage(messages.exportCollection)}
                </a>
              </div>
            </div>
          </section>
        )}

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
              <button
                type="button"
                onClick={runFirstAid}
                disabled={runningAction === 'first-aid'}
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {intl.formatMessage(messages.firstAid)}
              </button>
              <a
                href="/api/v1/dashboard/first-aid/report"
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60"
              >
                {intl.formatMessage(messages.firstAidReport)}
              </a>
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60"
              >
                {intl.formatMessage(messages.backupPreview)}
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={previewSettingsBackup}
              />
            </div>
            {backupPreview && (
              <div className="mb-3 rounded bg-stone-900 px-3 py-2 text-xs text-gray-300">
                <p className="font-semibold text-white">
                  {intl.formatMessage(messages.restoreDiff)}
                </p>
                <p className="mt-1">
                  {backupPreview.current?.collectionCount || 0} -&gt;{' '}
                  {backupPreview.incoming?.collectionCount || 0} collections
                </p>
                <p className="mt-1 text-gray-500">
                  {(backupPreview.changedSections || [])
                    .map((section) => section.section)
                    .join(', ') || intl.formatMessage(messages.noItems)}
                </p>
                {backupPreview.valid && (
                  <button
                    type="button"
                    onClick={restoreSettingsBackup}
                    disabled={runningAction === 'restore-backup'}
                    className="mt-2 rounded border border-orange-500/60 px-3 py-1.5 text-xs font-semibold text-orange-200 transition-colors hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {intl.formatMessage(messages.restoreBackup)}
                  </button>
                )}
              </div>
            )}
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
            <ExclamationTriangleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.problemDetails)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.problemDetails || []).slice(0, 6).length ? (
              (intelligence?.problemDetails || [])
                .slice(0, 6)
                .map((problem) => (
                  <a
                    key={problem.id}
                    href={problem.href}
                    className="block rounded border border-gray-700 px-3 py-2 transition-colors hover:border-orange-500/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={`truncate text-sm font-medium ${
                          problem.severity === 'error'
                            ? 'text-red-300'
                            : 'text-orange-300'
                        }`}
                      >
                        {problem.title}
                      </p>
                      <span className="text-xs text-gray-500">
                        {problem.area}
                      </span>
                    </div>
                    <p className="line-clamp-2 mt-1 text-xs text-gray-400">
                      {problem.message}
                    </p>
                  </a>
                ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BoltIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.repairCenter)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.repairCandidates || []).slice(0, 6).length ? (
              (intelligence?.repairCandidates || [])
                .slice(0, 6)
                .map((candidate) => (
                  <div
                    key={candidate.id}
                    className="rounded border border-gray-700 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-white">
                        {candidate.title}
                      </p>
                      <span
                        className={`text-xs font-semibold ${
                          candidate.severity === 'attention'
                            ? 'text-red-300'
                            : 'text-orange-300'
                        }`}
                      >
                        {candidate.type}
                      </span>
                    </div>
                    <p className="line-clamp-2 mt-1 text-xs text-gray-400">
                      {candidate.message}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={candidate.href}
                        className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                      >
                        {intl.formatMessage(messages.problemDetails)}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          runRepairAction(
                            candidate.type === 'missing-rating-key'
                              ? 'repair-rating-key'
                              : 'retry-sync',
                            candidate.configId
                          )
                        }
                        className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                      >
                        {candidate.type === 'missing-rating-key'
                          ? intl.formatMessage(messages.repairRatingKey)
                          : intl.formatMessage(messages.repairRetrySync)}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          addRepairToQueue(
                            candidate.type === 'missing-rating-key'
                              ? 'repair-rating-key'
                              : 'retry-sync',
                            candidate.configId,
                            candidate.title
                          )
                        }
                        className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                      >
                        {intl.formatMessage(messages.addToQueue)}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runRepairAction('make-visible', candidate.configId)
                        }
                        className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                      >
                        {intl.formatMessage(messages.repairMakeVisible)}
                      </button>
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BoltIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.repairQueue)}
          </h4>
          <div className="space-y-2">
            {repairQueue.length ? (
              repairQueue.map((item) => (
                <div
                  key={`${item.actionId}-${item.configId}`}
                  className="rounded bg-stone-900 px-3 py-2"
                >
                  <p className="text-sm font-medium text-gray-200">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{item.actionId}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={runRepairQueue}
            disabled={!repairQueue.length || runningAction === 'repair-queue'}
            className="mt-3 rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {intl.formatMessage(messages.runQueue)}
          </button>
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
          <button
            type="button"
            onClick={runAllSourceTests}
            disabled={runningAction === 'source-test-all'}
            className="mt-3 rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {intl.formatMessage(messages.runAllSourceTests)}
          </button>
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

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BeakerIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.sourceTestHistory)}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.sourceSuccessRate, {
                count: intelligence?.sourceTestHistory?.successRate || 0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.sourceFailures, {
                count: intelligence?.sourceTestHistory?.failures || 0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.averageLatency, {
                count: intelligence?.sourceTestHistory?.averageLatencyMs || 0,
              })}
            </p>
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.tautulliDataQuality)}
          </h4>
          <div className="space-y-2">
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.matchedCollections, {
                count:
                  intelligence?.tautulliDataQuality
                    ?.tautulliMatchedCollections || 0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.missingRatingKeys, {
                count:
                  intelligence?.tautulliDataQuality?.missingRatingKeyCount || 0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.noTautulliMatch, {
                count:
                  intelligence?.tautulliDataQuality?.noTautulliMatchCount || 0,
              })}
            </p>
            <p className="text-xs text-gray-500">
              {intelligence?.tautulliDataQuality?.artworkCache.strategy}
            </p>
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <RectangleStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.tautulliMapping)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.tautulliMappingDebugger || [])
              .slice(0, 6)
              .map((mapping) => (
                <div
                  key={mapping.id}
                  className="rounded bg-stone-900 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {mapping.name}
                    </p>
                    <span
                      className={`text-xs font-semibold ${
                        mapping.mapped ? 'text-green-300' : 'text-orange-300'
                      }`}
                    >
                      {mapping.reason}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {mapping.plexRatingKey || 'no rating key'} / {mapping.plays}{' '}
                    plays
                  </p>
                </div>
              ))}
          </div>
          <button
            type="button"
            onClick={runMappingAutoFix}
            disabled={runningAction === 'mapping-autofix'}
            className="mt-3 rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {intl.formatMessage(messages.runMappingAutofix)}
          </button>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BeakerIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.syncDryRunDetails)}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.dryRunChecks, {
                count:
                  intelligence?.detailedSyncDryRun?.wouldCheckCollections || 0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.dryRunRetries, {
                count: intelligence?.detailedSyncDryRun?.wouldRetryErrors || 0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.dryRunMissing, {
                count:
                  intelligence?.detailedSyncDryRun?.wouldProcessMissingItems ||
                  0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.dryRunPlaceholders, {
                count:
                  intelligence?.detailedSyncDryRun?.wouldRevisitPlaceholders ||
                  0,
              })}
            </p>
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ExclamationTriangleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.settingsConsistency)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.settingsConsistency || []).slice(0, 5).length ? (
              (intelligence?.settingsConsistency || [])
                .slice(0, 5)
                .map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded bg-stone-900 px-3 py-2"
                  >
                    <p
                      className={`text-sm font-medium ${
                        issue.severity === 'error'
                          ? 'text-red-300'
                          : 'text-orange-300'
                      }`}
                    >
                      {issue.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {issue.message}
                    </p>
                  </div>
                ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.dashboardPerformance)}
          </h4>
          <div className="space-y-2">
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.cacheEntries, {
                count: intelligence?.dashboardPerformance?.cacheEntries || 0,
              })}
            </p>
            <p className="text-xs text-gray-500">
              {intelligence?.dashboardPerformance?.strategy}
            </p>
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ExclamationTriangleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.notifications)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.notifications || []).slice(0, 6).length ? (
              (intelligence?.notifications || []).slice(0, 6).map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="block rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-900/70"
                >
                  <p
                    className={`text-sm font-medium ${
                      item.severity === 'error'
                        ? 'text-red-300'
                        : item.severity === 'warning'
                        ? 'text-orange-300'
                        : 'text-gray-300'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="line-clamp-2 mt-1 text-xs text-gray-500">
                    {item.message}
                  </p>
                </a>
              ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.healthSnapshots)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.healthSnapshots || []).slice(-5).length ? (
              (intelligence?.healthSnapshots || [])
                .slice(-5)
                .map((snapshot) => (
                  <div
                    key={snapshot.date}
                    className="rounded bg-stone-900 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-200">
                        {snapshot.date}
                      </p>
                      <span className="text-xs text-orange-300">
                        {snapshot.averageScore}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {snapshot.criticalCollections} critical /{' '}
                      {snapshot.warningCollections} warning
                    </p>
                  </div>
                ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <SparklesIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.releaseStatus)}
          </h4>
          <div className="space-y-2">
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.installedVersion, {
                version: intelligence?.releaseStatus?.installedVersion || '',
              })}
            </p>
            {intelligence?.releaseStatus?.updateAvailable ? (
              <a
                href={intelligence.releaseStatus.latestUrl}
                className="block rounded border border-orange-500/50 px-3 py-2 text-sm font-semibold text-orange-200 transition-colors hover:bg-orange-500/10"
              >
                {intl.formatMessage(messages.releaseUpdateAvailable, {
                  version: intelligence.releaseStatus.latestVersion,
                })}
              </a>
            ) : (
              <p className="rounded bg-stone-900 px-3 py-2 text-sm text-green-300">
                {intl.formatMessage(messages.moduleReady)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <SparklesIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.releaseChanges)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.releaseChanges?.highlights || []).map(
              (highlight) => (
                <p
                  key={highlight}
                  className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300"
                >
                  {highlight}
                </p>
              )
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ClockIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.auditLog)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.auditLog || []).slice(0, 5).length ? (
              (intelligence?.auditLog || []).slice(0, 5).map((event) => (
                <div key={event.id} className="rounded bg-stone-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {event.title}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(event.at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="line-clamp-2 mt-1 text-xs text-gray-500">
                    {event.message}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
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
