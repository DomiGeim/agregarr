import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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
  hideOperationalIntelligence: 'Hide Operational Intelligence',
  showOperationalIntelligence: 'Show Operational Intelligence',
  collapseTile: 'Collapse tile',
  expandTile: 'Expand tile',
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
  manageTiles: 'Manage tiles',
  close: 'Close',
  exportHealthCsv: 'Export CSV',
  exportLayout: 'Export layout',
  importLayout: 'Import layout',
  quietMode: 'Quiet Mode',
  collectionHealthTimeline: 'Collection Health Timeline',
  sourceHealthTimeline: 'Source Health Timeline',
  tautulliDiagnostics: 'Tautulli Diagnostics',
  collectionConfigExplain: 'Collection Config Explain',
  preSyncValidator: 'Pre-Sync Validator',
  ghcrImageStatus: 'GHCR Image Status',
  jellyfinHealth: 'Jellyfin Health',
  embyHealth: 'Emby Health',
  whyEmpty: 'Why Empty?',
  supportPackage: 'Support Package',
  downloadSupportPackage: 'Download support package',
  rotateBackups: 'Rotate backups',
  saveLayoutServer: 'Save layout',
  loadLayoutServer: 'Load layout',
  clearDashboardCache: 'Clear cache',
  moveSectionUp: 'Up',
  moveSectionDown: 'Down',
  posterCleanup: 'Poster cleanup',
  previewPosterCleanup: 'Preview poster cleanup',
  deletePosterOrphans: 'Delete orphaned posters',
  releaseReadiness: 'Release readiness',
  checkReleaseReadiness: 'Check release readiness',
  overlayOrphans: 'Overlay Template Orphans',
  missingOverlayReferences: '{count} missing references',
  unusedOverlayTemplates: '{count} unused templates',
  previewRepair: 'Preview',
  repairPreview: 'Repair Preview',
  sourceAutoTested: 'Source tests run automatically.',
  autoHealMode: 'Auto-Heal Mode',
  runAutoHeal: 'Run Auto-Heal',
  smartInsights: 'Smart Insights',
  sourcePriority: 'Source Priority',
  syncWindowAdvisor: 'Sync Window Advisor',
  collectionQualityScore: 'Collection Quality Score',
  duplicateFinder: 'Duplicate Finder',
  dashboardWatchlist: 'Dashboard Watchlist',
  whyIsThisHere: 'Why Is This Here?',
  rollbackCandidates: 'Rollback Candidates',
  runRollback: 'Reset marker',
  first50FeatureMatrix: 'First 50 Feature Coverage',
  second50FeatureMatrix: 'Second 50 Feature Coverage',
  globalDashboardSearch: 'Global dashboard search',
  searchDashboard: 'Search dashboard',
  backupList: 'Backup List',
  syncHistory: 'Sync History',
  duplicateMergePreview: 'Duplicate Merge Preview',
  bulkCollectionExport: 'Bulk collection export',
  adminQualityGates: 'Admin Quality Gates',
  sourceAudit: 'Source Audit',
  collectionDependencies: 'Collection Dependencies',
  experimentCandidates: 'Experiment Candidates',
  syncCostEstimate: 'Sync Cost Estimate',
  implementedFeaturesTracked:
    '{count} implemented features are tracked by the dashboard.',
  syncRunning: 'Sync running',
  duplicateMatches: '{count} matches',
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
    sourceHealthTimeline?: {
      sourceId: string;
      name: string;
      successRate: number;
      averageLatencyMs: number;
      history: {
        date: string;
        ok: boolean;
        latencyMs: number;
      }[];
    }[];
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
    collectionHealthTimeline?: {
      id: string;
      name: string;
      latestScore: number;
      delta: number;
      history: {
        date: string;
        score: number;
        status: 'healthy' | 'warning' | 'critical';
      }[];
    }[];
    mappingScore?: {
      mappedCollections: number;
      totalCollections: number;
      score: number;
    };
    tautulliDiagnostics?: {
      configured: boolean;
      score: number;
      recommendation: string;
      checks: {
        id: string;
        status: 'ok' | 'watch' | 'attention';
        title: string;
        message: string;
      }[];
      endpoints?: {
        id: string;
        label: string;
        status: 'ok' | 'watch' | 'attention';
      }[];
    };
    jellyfinHealth?: {
      active: boolean;
      configured: boolean;
      libraryCount: number;
      score: number;
      status: 'ready' | 'watch' | 'attention';
      message: string;
    };
    embyHealth?: {
      active: boolean;
      configured: boolean;
      libraryCount: number;
      score: number;
      status: 'ready' | 'watch' | 'attention';
      message: string;
    };
    preSyncValidation?: {
      canSync: boolean;
      warnings: number;
      checks: {
        id: string;
        ok: boolean;
        severity: 'error' | 'warning' | 'info';
        title: string;
        message: string;
      }[];
    };
    ghcrStatus?: {
      image: string;
      ready: boolean;
      checkedAt: string;
      tags: {
        tag: string;
        available: boolean;
        statusCode: number;
      }[];
    };
    emptyCollectionInsights?: {
      id: string;
      name: string;
      healthScore: number;
      plays: number;
      reasons: string[];
      recommendation: string;
      href: string;
    }[];
    autoHeal?: {
      safeActions: number;
      canRun: boolean;
      message: string;
    };
    smartInsights?: {
      id: string;
      title: string;
      message: string;
      severity: 'error' | 'warning' | 'info';
    }[];
    sourcePriority?: {
      id: string;
      name: string;
      priority: number;
      usedByCollections: number;
      status: 'ok' | 'watch' | 'attention';
      recommendation: string;
    }[];
    syncWindow?: {
      recommendedWindow: string;
      reason: string;
      loadScore: number;
    };
    collectionQualityScores?: {
      id: string;
      name: string;
      score: number;
      healthScore: number;
      plays: number;
      status: 'ready' | 'watch' | 'attention';
      reason: string;
    }[];
    duplicateGroups?: {
      normalizedName: string;
      count: number;
      safePrimaryCandidate?: {
        id: string;
        name: string;
        type: string;
        libraryName?: string;
        needsSync: boolean;
      };
      items: {
        id: string;
        name: string;
        type: string;
        libraryName?: string;
        needsSync: boolean;
      }[];
    }[];
    dashboardWatchlist?: {
      id: string;
      name: string;
      score: number;
      reason: string;
      href: string;
    }[];
    whyCollections?: {
      id: string;
      name: string;
      type: string;
      reason: string;
      source: string;
      href: string;
    }[];
    rollbackCandidates?: {
      id: string;
      name: string;
      reason: string;
      safeAction: string;
    }[];
    first50FeatureMatrix?: {
      id: number;
      category: string;
      title: string;
      href: string;
      metric: string;
      status: 'ready' | 'watch' | 'attention';
      summary?: string;
    }[];
    second50FeatureMatrix?: {
      id: number;
      category: string;
      title: string;
      href: string;
      metric: string;
      status: 'ready' | 'watch' | 'attention';
      summary?: string;
    }[];
    adminQualityGates?: {
      id: string;
      title: string;
      ok: boolean;
      severity: 'error' | 'warning' | 'info';
      message: string;
      href: string;
    }[];
    sourceAudit?: {
      id: string;
      name: string;
      configured: boolean;
      status: string;
      usedByCollections: number;
      reliabilityScore?: number;
      reliabilityStatus?: string;
      message?: string;
    }[];
    collectionDependencies?: {
      totalDependencies: number;
      linkedGroups: {
        linkId: string;
        count: number;
      }[];
      multiSourceCollections: {
        id: string;
        name: string;
        type: string;
        sources: {
          type: string;
          name: string;
        }[];
      }[];
    };
    templateLibrary?: {
      type: string;
      count: number;
      healthy: number;
      readiness: number;
      examples: {
        id: string;
        name: string;
        score?: number;
      }[];
    }[];
    experimentCandidates?: {
      id: string;
      name: string;
      type: string;
      libraryName?: string;
      score: number;
      reason: string;
      href: string;
    }[];
    syncCostEstimate?: {
      totalCollections: number;
      autoRequestCount: number;
      needsSyncCount: number;
      warningCount: number;
      criticalCount: number;
      estimatedUnits: number;
      risk: 'ready' | 'watch' | 'attention';
      recommendation: string;
    };
    overlayOrphans?: {
      healthy: boolean;
      activeTemplates: number;
      configuredLibraries: number;
      missingReferenceCount: number;
      unusedTemplateCount: number;
      missingReferences: {
        libraryId: string;
        libraryName: string;
        templateId: number;
      }[];
      unusedTemplates: {
        id: number;
        name: string;
        type: string;
      }[];
    };
    backupHealth?: {
      latestBackupAt?: string;
      daysSinceBackup: number | null;
      recommended: boolean;
      settingsFingerprint: string;
      backupCount?: number;
      retention?: number;
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
    collectionConfigExplanations?: {
      id: string;
      name: string;
      type: string;
      libraryName?: string;
      healthScore: number;
      source: string;
      visibility: string;
      autoRequest: boolean;
      syncPlan: string;
      filters: string[];
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

interface DashboardSearchData {
  query: string;
  results: {
    id: string;
    type: string;
    title: string;
    subtitle: string;
    href: string;
  }[];
}

interface BackupListData {
  storagePath: string;
  retention: number;
  backups: {
    filename: string;
    sizeBytes: number;
    modifiedAt: string;
    downloadUrl: string;
  }[];
}

interface SyncHistoryData {
  running: boolean;
  lastGlobalSyncAt?: string;
  globalSyncError?: string;
  timeline: {
    id: string;
    type: string;
    title: string;
    message: string;
    at: string;
  }[];
}

interface DuplicateMergePreviewData {
  groups: NonNullable<
    NonNullable<DashboardInsightData['intelligence']>['duplicateGroups']
  >;
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
  const layoutInputRef = useRef<HTMLInputElement>(null);
  const [operationalIntelligenceHidden, setOperationalIntelligenceHidden] =
    useState(
      () =>
        typeof window !== 'undefined' &&
        localStorage.getItem('agregarr-dashboard-operational-hidden') === 'on'
    );
  const [
    operationalIntelligenceCollapsed,
    setOperationalIntelligenceCollapsed,
  ] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem('agregarr-dashboard-operational-collapsed') === 'on'
  );
  const { data, error, mutate } = useSWR<DashboardInsightData>(
    operationalIntelligenceHidden || operationalIntelligenceCollapsed
      ? null
      : '/api/v1/dashboard/stats'
  );
  const { data: backupList } = useSWR<BackupListData>(
    operationalIntelligenceHidden || operationalIntelligenceCollapsed
      ? null
      : '/api/v1/dashboard/backups'
  );
  const { data: syncHistory } = useSWR<SyncHistoryData>(
    operationalIntelligenceHidden || operationalIntelligenceCollapsed
      ? null
      : '/api/v1/dashboard/sync-history'
  );
  const { data: duplicateMergePreview } = useSWR<DuplicateMergePreviewData>(
    operationalIntelligenceHidden || operationalIntelligenceCollapsed
      ? null
      : '/api/v1/dashboard/duplicate-merge-preview'
  );
  const [operationQuery, setOperationQuery] = useState('');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
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
  const [layoutManagerOpen, setLayoutManagerOpen] = useState(false);
  const [repairPreview, setRepairPreview] = useState<{
    collection: { id: string; name: string; type: string };
    actionId: string;
    changes: string[];
    currentHealth?: { score?: number; status?: string; reasons: string[] };
  } | null>(null);
  const [posterCleanupPreview, setPosterCleanupPreview] = useState<{
    dryRun: boolean;
    counts: {
      scanned: number;
      orphaned: number;
      deleted: number;
      skipped: number;
    };
    orphaned: { filename: string; reason: string }[];
    skipped: { filename: string; reason: string }[];
  } | null>(null);
  const [releaseReadiness, setReleaseReadiness] = useState<{
    version: string;
    ready: boolean;
    generatedAt: string;
    checks: {
      id: string;
      title: string;
      ok: boolean;
      message: string;
    }[];
  } | null>(null);
  const dashboardSearchKey = dashboardSearchQuery.trim()
    ? `/api/v1/dashboard/search?q=${encodeURIComponent(
        dashboardSearchQuery.trim()
      )}`
    : null;
  const { data: dashboardSearch } =
    useSWR<DashboardSearchData>(dashboardSearchKey);
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
  const runPosterCleanup = async (dryRun: boolean) => {
    setRunningAction(dryRun ? 'poster-cleanup-preview' : 'poster-cleanup');
    setActionMessage(null);

    try {
      const response = await axios.post('/api/v1/posters/cleanup-orphans', {
        dryRun,
      });
      setPosterCleanupPreview(response.data);
      setActionMessage(
        `${intl.formatMessage(messages.actionSucceeded)} ${
          response.data?.counts?.orphaned || 0
        } ${intl.formatMessage(messages.noItems).toLowerCase()}`
      );
      await mutate();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const checkReleaseReadiness = async () => {
    setRunningAction('release-readiness');
    setActionMessage(null);

    try {
      const response = await axios.get('/api/v1/dashboard/release-readiness');
      setReleaseReadiness(response.data);
      setActionMessage(
        `${response.data.version}: ${
          response.data.ready
            ? intl.formatMessage(messages.moduleReady)
            : intl.formatMessage(messages.moduleWatch)
        }`
      );
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
    localStorage.removeItem('agregarr-dashboard-quiet-mode');
    window.location.reload();
  };
  const exportDashboardLayout = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      sections: Object.fromEntries(
        Object.keys(localStorage)
          .filter((key) => key.startsWith('agregarr-dashboard-section'))
          .map((key) => [key, localStorage.getItem(key)])
      ),
      quietMode: localStorage.getItem('agregarr-dashboard-quiet-mode') === 'on',
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, undefined, 2)], {
        type: 'application/json',
      })
    );
    const link = document.createElement('a');

    link.href = url;
    link.download = `agregarr-dashboard-layout-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importDashboardLayout = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const payload = JSON.parse(await file.text()) as {
        sections?: Record<string, string | null>;
        quietMode?: boolean;
      };

      Object.entries(payload.sections || {}).forEach(([key, value]) => {
        if (key.startsWith('agregarr-dashboard-section') && value) {
          localStorage.setItem(key, value);
        }
      });

      if (payload.quietMode) {
        localStorage.setItem('agregarr-dashboard-quiet-mode', 'on');
      } else {
        localStorage.removeItem('agregarr-dashboard-quiet-mode');
      }

      window.location.reload();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      event.target.value = '';
    }
  };
  const saveDashboardLayoutToServer = async () => {
    setRunningAction('save-layout-server');
    setActionMessage(null);

    try {
      await axios.post('/api/v1/dashboard/layout', {
        sections: Object.fromEntries(
          Object.keys(localStorage)
            .filter((key) => key.startsWith('agregarr-dashboard-section'))
            .map((key) => [key, localStorage.getItem(key)])
        ),
        quietMode:
          localStorage.getItem('agregarr-dashboard-quiet-mode') === 'on',
      });
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const loadDashboardLayoutFromServer = async () => {
    setRunningAction('load-layout-server');
    setActionMessage(null);

    try {
      const response = await axios.get('/api/v1/dashboard/layout');
      const layout = response.data?.layout || {};

      Object.entries(layout.sections || {}).forEach(([key, value]) => {
        if (
          key.startsWith('agregarr-dashboard-section') &&
          typeof value === 'string'
        ) {
          localStorage.setItem(key, value);
        }
      });

      if (layout.quietMode) {
        localStorage.setItem('agregarr-dashboard-quiet-mode', 'on');
      } else {
        localStorage.removeItem('agregarr-dashboard-quiet-mode');
      }

      window.location.reload();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const rotateBackups = async () => {
    setRunningAction('rotate-backups');
    setActionMessage(null);

    try {
      const response = await axios.post('/api/v1/dashboard/backups/rotate');
      setActionMessage(
        `${intl.formatMessage(messages.actionSucceeded)} ${
          response.data.removed || 0
        }`
      );
      await mutate();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const applyQuietMode = () => {
    const keepOpen = new Set([
      'first-aid-status',
      'notifications',
      'smart-insights',
      'collection-health-scores',
      'collection-health-timeline',
      'source-health-timeline',
      'tautulli-diagnostics',
      'action-center',
      'problem-details',
      'collection-repair-center',
      'rollback-candidates',
    ]);
    const sections = Array.from(
      dashboardRootRef.current?.querySelectorAll('section') || []
    ).map((section) => {
      const sectionElement = section as HTMLElement;

      return (
        sectionElement.dataset.dashboardSectionId ||
        getHeadingSectionId(section.querySelector('h4'))
      );
    });
    const quietModeActive =
      localStorage.getItem('agregarr-dashboard-quiet-mode') === 'on';

    sections.forEach((sectionId) => {
      if (sectionId) {
        localStorage.setItem(
          `agregarr-dashboard-section-${sectionId}`,
          !quietModeActive && keepOpen.has(sectionId)
            ? 'expanded'
            : !quietModeActive
            ? 'collapsed'
            : 'expanded'
        );
      }
    });

    if (quietModeActive) {
      localStorage.removeItem('agregarr-dashboard-quiet-mode');
    } else {
      localStorage.setItem('agregarr-dashboard-quiet-mode', 'on');
    }

    window.location.reload();
  };
  const getHeadingSectionId = (heading: Element | null) => {
    const textNode = Array.from(heading?.childNodes || []).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );

    return (textNode?.textContent || heading?.textContent || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  };
  const applyLayoutPreset = (
    preset: 'minimal' | 'tautulli' | 'repair' | 'full'
  ) => {
    const sections = Array.from(
      dashboardRootRef.current?.querySelectorAll('section') || []
    ).map((section) => {
      const sectionElement = section as HTMLElement;

      return (
        sectionElement.dataset.dashboardSectionId ||
        getHeadingSectionId(section.querySelector('h4'))
      );
    });
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
  const clearDashboardCache = async () => {
    setRunningAction('clear-cache');
    setActionMessage(null);

    try {
      await axios.post('/api/v1/dashboard/cache/clear');
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
      window.location.reload();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const previewRepairAction = async (actionId: string, configId: string) => {
    setRunningAction(`preview-${actionId}-${configId}`);
    setActionMessage(null);

    try {
      const response = await axios.post(
        `/api/v1/dashboard/repair-preview/${actionId}`,
        { configId }
      );
      setRepairPreview(response.data);
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
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
  const runAutoHeal = async () => {
    setRunningAction('auto-heal');
    setActionMessage(null);

    try {
      await axios.post('/api/v1/dashboard/auto-heal');
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
      await mutate();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const runCollectionRollback = async (collectionId: string) => {
    setRunningAction(`rollback-${collectionId}`);
    setActionMessage(null);

    try {
      await axios.post(`/api/v1/dashboard/collection-rollback/${collectionId}`);
      setActionMessage(intl.formatMessage(messages.actionSucceeded));
      await mutate();
    } catch (err) {
      setActionMessage(intl.formatMessage(messages.actionFailed));
    } finally {
      setRunningAction(null);
    }
  };
  const toggleOperationalIntelligence = () => {
    const nextHidden = !operationalIntelligenceHidden;

    setOperationalIntelligenceHidden(nextHidden);

    if (nextHidden) {
      localStorage.setItem('agregarr-dashboard-operational-hidden', 'on');
    } else {
      localStorage.removeItem('agregarr-dashboard-operational-hidden');
    }
  };

  const toggleOperationalIntelligenceCollapsed = () => {
    setOperationalIntelligenceCollapsed((current) => {
      const next = !current;

      if (next) {
        localStorage.setItem('agregarr-dashboard-operational-collapsed', 'on');
      } else {
        localStorage.removeItem('agregarr-dashboard-operational-collapsed');
      }

      return next;
    });
  };

  useEffect(() => {
    if (
      !data ||
      operationalIntelligenceHidden ||
      operationalIntelligenceCollapsed
    ) {
      return;
    }

    const autoTestKey = 'agregarr-dashboard-source-auto-test-at';
    const lastRun = Number(localStorage.getItem(autoTestKey) || 0);
    const twelveHours = 12 * 60 * 60 * 1000;

    if (Date.now() - lastRun < twelveHours) {
      return;
    }

    localStorage.setItem(autoTestKey, String(Date.now()));
    axios
      .post('/api/v1/dashboard/source-test-all')
      .catch(() => localStorage.removeItem(autoTestKey));
  }, [data, operationalIntelligenceHidden, operationalIntelligenceCollapsed]);

  useEffect(() => {
    const root = dashboardRootRef.current;

    if (
      !root ||
      operationalIntelligenceHidden ||
      operationalIntelligenceCollapsed
    ) {
      return;
    }

    const sections = Array.from(root.querySelectorAll('section'));

    sections.forEach((section) => {
      const heading = section.querySelector('h4');

      if (!heading || heading.querySelector('[data-collapse-button]')) {
        return;
      }

      const sectionId = getHeadingSectionId(heading);
      const key = `agregarr-dashboard-section-${sectionId}`;
      const button = document.createElement('button');
      const upButton = document.createElement('button');
      const downButton = document.createElement('button');
      const orderKey = 'agregarr-dashboard-section-order';
      (section as HTMLElement).dataset.dashboardSectionId = sectionId;
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
          const itemId =
            (item as HTMLElement).dataset.dashboardSectionId ||
            getHeadingSectionId(itemHeading);

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
      upButton.textContent = intl.formatMessage(messages.moveSectionUp);
      downButton.textContent = intl.formatMessage(messages.moveSectionDown);
      heading.classList.add('gap-2');
      heading.appendChild(upButton);
      heading.appendChild(downButton);
      heading.appendChild(button);
      applyState(collapsed);
      applyOrder();
    });
  }, [
    data,
    intl,
    operationalIntelligenceHidden,
    operationalIntelligenceCollapsed,
  ]);

  if (operationalIntelligenceHidden) {
    return (
      <div className="rounded-lg border border-gray-700 bg-stone-800 px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center text-lg font-medium text-white">
              <SparklesIcon className="mr-2 h-5 w-5 text-orange-400" />
              {intl.formatMessage(messages.title)}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {intl.formatMessage(messages.subtitle)}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleOperationalIntelligence}
            className="rounded border border-orange-500/50 px-3 py-2 text-xs font-semibold text-orange-100 transition-colors hover:bg-orange-500/10"
          >
            {intl.formatMessage(messages.showOperationalIntelligence)}
          </button>
        </div>
      </div>
    );
  }

  if (operationalIntelligenceCollapsed) {
    return (
      <div className="rounded-lg border border-gray-700 bg-stone-800 px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center text-lg font-medium text-white">
              <SparklesIcon className="mr-2 h-5 w-5 text-orange-400" />
              {intl.formatMessage(messages.title)}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {intl.formatMessage(messages.subtitle)}
            </p>
          </div>
          <button
            type="button"
            aria-label={intl.formatMessage(messages.expandTile)}
            className="text-gray-500 transition hover:text-gray-200"
            onClick={toggleOperationalIntelligenceCollapsed}
          >
            <ChevronDownIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center text-lg font-medium text-white">
              <SparklesIcon className="mr-2 h-5 w-5 text-orange-400" />
              {intl.formatMessage(messages.title)}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {intl.formatMessage(messages.subtitle)}
            </p>
          </div>
          <button
            type="button"
            aria-label={intl.formatMessage(messages.collapseTile)}
            className="text-gray-500 transition hover:text-gray-200"
            onClick={toggleOperationalIntelligenceCollapsed}
          >
            <ChevronUpIcon className="h-5 w-5" />
          </button>
        </div>
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
          <button
            type="button"
            onClick={() => setLayoutManagerOpen(true)}
            className="rounded border border-orange-500/50 px-2 py-1 text-xs font-semibold text-orange-100 transition-colors hover:bg-orange-500/10"
          >
            {intl.formatMessage(messages.manageTiles)}
          </button>
          <button
            type="button"
            onClick={applyQuietMode}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.quietMode)}
          </button>
          <button
            type="button"
            onClick={exportDashboardLayout}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.exportLayout)}
          </button>
          <button
            type="button"
            onClick={() => layoutInputRef.current?.click()}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.importLayout)}
          </button>
          <input
            ref={layoutInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importDashboardLayout}
          />
          <button
            type="button"
            onClick={saveDashboardLayoutToServer}
            disabled={runningAction === 'save-layout-server'}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {intl.formatMessage(messages.saveLayoutServer)}
          </button>
          <button
            type="button"
            onClick={loadDashboardLayoutFromServer}
            disabled={runningAction === 'load-layout-server'}
            className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {intl.formatMessage(messages.loadLayoutServer)}
          </button>
          <button
            type="button"
            onClick={toggleOperationalIntelligence}
            className="rounded border border-red-500/50 px-2 py-1 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/10"
          >
            {intl.formatMessage(messages.hideOperationalIntelligence)}
          </button>
        </div>
      </div>

      {layoutManagerOpen && (
        <div className="border-b border-gray-700 bg-stone-900 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-white">
              {intl.formatMessage(messages.manageTiles)}
            </h4>
            <button
              type="button"
              onClick={() => setLayoutManagerOpen(false)}
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
            >
              {intl.formatMessage(messages.close)}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['minimal', 'tautulli', 'repair', 'full'] as const).map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyLayoutPreset(preset)}
                  className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                >
                  {preset === 'minimal'
                    ? intl.formatMessage(messages.layoutPresetMinimal)
                    : preset === 'tautulli'
                    ? intl.formatMessage(messages.layoutPresetTautulli)
                    : preset === 'repair'
                    ? intl.formatMessage(messages.layoutPresetRepair)
                    : intl.formatMessage(messages.layoutPresetFull)}
                </button>
              )
            )}
            <button
              type="button"
              onClick={resetLayout}
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
            >
              {intl.formatMessage(messages.resetLayout)}
            </button>
            <button
              type="button"
              onClick={applyQuietMode}
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
            >
              {intl.formatMessage(messages.quietMode)}
            </button>
            <button
              type="button"
              onClick={exportDashboardLayout}
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
            >
              {intl.formatMessage(messages.exportLayout)}
            </button>
            <button
              type="button"
              onClick={() => layoutInputRef.current?.click()}
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
            >
              {intl.formatMessage(messages.importLayout)}
            </button>
            <button
              type="button"
              onClick={saveDashboardLayoutToServer}
              disabled={runningAction === 'save-layout-server'}
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {intl.formatMessage(messages.saveLayoutServer)}
            </button>
            <button
              type="button"
              onClick={loadDashboardLayoutFromServer}
              disabled={runningAction === 'load-layout-server'}
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {intl.formatMessage(messages.loadLayoutServer)}
            </button>
          </div>
        </div>
      )}

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="flex items-center text-sm font-semibold text-white">
              <SparklesIcon className="mr-2 h-4 w-4 text-orange-400" />
              {intl.formatMessage(messages.first50FeatureMatrix)}
            </h4>
            <a
              href="/api/v1/dashboard/collections/export-bulk"
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
            >
              {intl.formatMessage(messages.bulkCollectionExport)}
            </a>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {(intelligence?.first50FeatureMatrix || [])
              .slice(0, 8)
              .map((feature) => (
                <a
                  key={feature.id}
                  href={feature.href}
                  className="rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-700"
                >
                  <p className="text-xs text-gray-500">
                    #{feature.id} · {feature.category}
                  </p>
                  <p className="line-clamp-2 mt-1 text-sm font-semibold text-white">
                    {feature.title}
                  </p>
                  <p className="mt-1 text-xs text-orange-300">
                    {feature.metric}
                  </p>
                </a>
              ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {intl.formatMessage(messages.implementedFeaturesTracked, {
              count: (intelligence?.first50FeatureMatrix || []).length,
            })}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 pt-4">
            <h4 className="flex items-center text-sm font-semibold text-white">
              <SparklesIcon className="mr-2 h-4 w-4 text-orange-400" />
              {intl.formatMessage(messages.second50FeatureMatrix)}
            </h4>
            <a
              href="/api/v1/dashboard/admin-quality"
              className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
            >
              {intl.formatMessage(messages.adminQualityGates)}
            </a>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {(intelligence?.second50FeatureMatrix || [])
              .slice(0, 8)
              .map((feature) => (
                <a
                  key={feature.id}
                  href={feature.href}
                  className="rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-700"
                >
                  <p className="text-xs text-gray-500">
                    #{feature.id} · {feature.category}
                  </p>
                  <p className="line-clamp-2 mt-1 text-sm font-semibold text-white">
                    {feature.title}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      feature.status === 'attention'
                        ? 'text-red-300'
                        : feature.status === 'watch'
                        ? 'text-orange-300'
                        : 'text-green-300'
                    }`}
                  >
                    {feature.metric}
                  </p>
                </a>
              ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {intl.formatMessage(messages.implementedFeaturesTracked, {
              count: (intelligence?.second50FeatureMatrix || []).length,
            })}
          </p>
        </section>

        <section className="rounded-md border border-gray-700 p-4 lg:col-span-2">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <QuestionMarkCircleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.globalDashboardSearch)}
          </h4>
          <input
            type="search"
            value={dashboardSearchQuery}
            onChange={(event) => setDashboardSearchQuery(event.target.value)}
            placeholder={intl.formatMessage(messages.searchDashboard)}
            className="w-full rounded border border-gray-700 bg-stone-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-orange-500/70"
          />
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            {(dashboardSearch?.results || []).slice(0, 9).map((result) => (
              <a
                key={result.id}
                href={result.href}
                className="rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-700"
              >
                <p className="text-xs text-gray-500">{result.type}</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {result.title}
                </p>
                <p className="line-clamp-2 mt-1 text-xs text-gray-400">
                  {result.subtitle}
                </p>
              </a>
            ))}
          </div>
          {dashboardSearchQuery.trim() && !dashboardSearch?.results?.length && (
            <p className="mt-3 text-sm text-gray-500">
              {intl.formatMessage(messages.noItems)}
            </p>
          )}
        </section>

        <section className="rounded-md border border-gray-700 p-4 lg:col-span-2">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <CheckCircleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.adminQualityGates)}
          </h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(intelligence?.adminQualityGates || []).map((gate) => (
              <a
                key={gate.id}
                href={gate.href}
                className="rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {gate.title}
                  </p>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      gate.ok
                        ? 'border-green-500/40 text-green-300'
                        : gate.severity === 'error'
                        ? 'border-red-500/40 text-red-300'
                        : 'border-orange-500/40 text-orange-300'
                    }`}
                  >
                    {gate.ok
                      ? intl.formatMessage(messages.moduleReady)
                      : gate.severity === 'error'
                      ? intl.formatMessage(messages.moduleAttention)
                      : intl.formatMessage(messages.moduleWatch)}
                  </span>
                </div>
                <p className="line-clamp-2 mt-2 text-xs text-gray-400">
                  {gate.message}
                </p>
              </a>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded bg-stone-900 px-3 py-2">
              <p className="text-xs text-gray-500">
                {intl.formatMessage(messages.syncCostEstimate)}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {intelligence?.syncCostEstimate?.estimatedUnits || 0}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {intelligence?.syncCostEstimate?.recommendation || '-'}
              </p>
            </div>
            <div className="rounded bg-stone-900 px-3 py-2">
              <p className="text-xs text-gray-500">
                {intl.formatMessage(messages.sourceAudit)}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {intelligence?.sourceAudit?.length || 0}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {(intelligence?.sourceAudit || [])
                  .filter((source) => !source.configured)
                  .map((source) => source.name)
                  .slice(0, 3)
                  .join(', ') || intl.formatMessage(messages.moduleReady)}
              </p>
            </div>
            <div className="rounded bg-stone-900 px-3 py-2">
              <p className="text-xs text-gray-500">
                {intl.formatMessage(messages.collectionDependencies)}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {intelligence?.collectionDependencies?.totalDependencies || 0}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {
                  (
                    intelligence?.collectionDependencies
                      ?.multiSourceCollections || []
                  ).length
                }{' '}
                multi-source
              </p>
            </div>
            <div className="rounded bg-stone-900 px-3 py-2">
              <p className="text-xs text-gray-500">
                {intl.formatMessage(messages.experimentCandidates)}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {intelligence?.experimentCandidates?.length || 0}
              </p>
              <p className="line-clamp-1 mt-1 text-xs text-gray-400">
                {intelligence?.experimentCandidates?.[0]?.name || '-'}
              </p>
            </div>
          </div>
        </section>

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
            {intl.formatMessage(messages.backupList)}
          </h4>
          <p className="text-xs text-gray-500">
            {backupList?.storagePath || '-'}
          </p>
          <div className="mt-3 space-y-2">
            {(backupList?.backups || []).slice(0, 5).map((backup) => (
              <a
                key={backup.filename}
                href={backup.downloadUrl}
                className="block rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-700"
              >
                <p className="truncate text-sm font-semibold text-white">
                  {backup.filename}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(backup.modifiedAt).toLocaleString()} ·{' '}
                  {Math.round(backup.sizeBytes / 1024)} KB
                </p>
              </a>
            ))}
            {!backupList?.backups?.length && (
              <p className="text-sm text-gray-500">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ClockIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.syncHistory)}
          </h4>
          <div className="rounded bg-stone-900 px-3 py-2">
            <p
              className={`text-sm font-semibold ${
                syncHistory?.running ? 'text-orange-300' : 'text-green-300'
              }`}
            >
              {syncHistory?.running
                ? intl.formatMessage(messages.syncRunning)
                : intl.formatMessage(messages.moduleReady)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {syncHistory?.lastGlobalSyncAt
                ? new Date(syncHistory.lastGlobalSyncAt).toLocaleString()
                : '-'}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {(syncHistory?.timeline || []).slice(0, 4).map((event) => (
              <div key={event.id} className="rounded bg-stone-900 px-3 py-2">
                <p className="text-sm font-semibold text-white">
                  {event.title}
                </p>
                <p className="line-clamp-2 mt-1 text-xs text-gray-400">
                  {event.message}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4 lg:col-span-2">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <RectangleStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.duplicateMergePreview)}
          </h4>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {(duplicateMergePreview?.groups || []).slice(0, 6).map((group) => (
              <div
                key={group.normalizedName}
                className="rounded bg-stone-900 px-3 py-2"
              >
                <p className="text-sm font-semibold text-white">
                  {group.normalizedName}
                </p>
                <p className="mt-1 text-xs text-orange-300">
                  {intl.formatMessage(messages.duplicateMatches, {
                    count: group.count,
                  })}
                </p>
                <p className="line-clamp-2 mt-1 text-xs text-gray-400">
                  {group.safePrimaryCandidate?.name || group.items[0]?.name}
                </p>
              </div>
            ))}
            {!duplicateMergePreview?.groups?.length && (
              <p className="text-sm text-gray-500">
                {intl.formatMessage(messages.noItems)}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BoltIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.autoHealMode)}
          </h4>
          <p className="text-sm text-gray-300">
            {intelligence?.autoHeal?.message}
          </p>
          <p className="mt-2 rounded bg-stone-900 px-3 py-2 text-sm text-orange-300">
            {intelligence?.autoHeal?.safeActions || 0} safe actions
          </p>
          <button
            type="button"
            onClick={runAutoHeal}
            disabled={
              runningAction === 'auto-heal' || !intelligence?.autoHeal?.canRun
            }
            className="mt-3 rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {intl.formatMessage(messages.runAutoHeal)}
          </button>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <LightBulbIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.smartInsights)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.smartInsights || []).length ? (
              (intelligence?.smartInsights || []).map((insight) => (
                <div
                  key={insight.id}
                  className="rounded bg-stone-900 px-3 py-2"
                >
                  <p
                    className={`text-sm font-medium ${
                      insight.severity === 'error'
                        ? 'text-red-300'
                        : insight.severity === 'warning'
                        ? 'text-orange-300'
                        : 'text-gray-200'
                    }`}
                  >
                    {insight.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {insight.message}
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
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.collectionQualityScore)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.collectionQualityScores || [])
              .slice(0, 6)
              .map((item) => (
                <a
                  key={item.id}
                  href={`/api/v1/dashboard/collection-diff/${item.id}`}
                  className="block rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-900/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {item.name}
                    </p>
                    <span className="text-xs font-semibold text-orange-300">
                      {item.score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.reason} / {item.plays} plays
                  </p>
                </a>
              ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.sourcePriority)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.sourcePriority || []).slice(0, 6).map((source) => (
              <div key={source.id} className="rounded bg-stone-900 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-200">
                    {source.name}
                  </p>
                  <span className="text-xs text-orange-300">
                    {source.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {source.recommendation}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ClockIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.syncWindowAdvisor)}
          </h4>
          <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
            {intelligence?.syncWindow?.recommendedWindow}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {intelligence?.syncWindow?.reason}
          </p>
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
              <a
                href="/api/v1/dashboard/support-package"
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60"
              >
                {intl.formatMessage(messages.downloadSupportPackage)}
              </a>
              <button
                type="button"
                onClick={() => runPosterCleanup(true)}
                disabled={runningAction === 'poster-cleanup-preview'}
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {intl.formatMessage(messages.previewPosterCleanup)}
              </button>
              <button
                type="button"
                onClick={() => runPosterCleanup(false)}
                disabled={runningAction === 'poster-cleanup'}
                className="rounded border border-orange-500/60 px-3 py-2 text-xs font-semibold text-orange-200 transition-colors hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {intl.formatMessage(messages.deletePosterOrphans)}
              </button>
              <button
                type="button"
                onClick={checkReleaseReadiness}
                disabled={runningAction === 'release-readiness'}
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {intl.formatMessage(messages.checkReleaseReadiness)}
              </button>
              <button
                type="button"
                onClick={rotateBackups}
                disabled={runningAction === 'rotate-backups'}
                className="rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {intl.formatMessage(messages.rotateBackups)}
              </button>
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
            {posterCleanupPreview && (
              <div className="mb-3 rounded bg-stone-900 px-3 py-2 text-xs text-gray-300">
                <p className="font-semibold text-white">
                  {intl.formatMessage(messages.posterCleanup)}
                </p>
                <p className="mt-1">
                  {posterCleanupPreview.counts.scanned} scanned /{' '}
                  {posterCleanupPreview.counts.orphaned} orphaned /{' '}
                  {posterCleanupPreview.counts.deleted || 0} deleted
                </p>
                <p className="mt-1 truncate text-gray-500">
                  {posterCleanupPreview.orphaned
                    .slice(0, 5)
                    .map((item) => item.filename)
                    .join(', ') || intl.formatMessage(messages.noItems)}
                </p>
              </div>
            )}
            {releaseReadiness && (
              <div className="mb-3 rounded bg-stone-900 px-3 py-2 text-xs text-gray-300">
                <p className="font-semibold text-white">
                  {intl.formatMessage(messages.releaseReadiness)}:{' '}
                  {releaseReadiness.version}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {releaseReadiness.checks.map((check) => (
                    <div
                      key={check.id}
                      className="rounded border border-gray-800 px-2 py-1"
                    >
                      <span
                        className={
                          check.ok ? 'text-green-300' : 'text-orange-300'
                        }
                      >
                        {check.title}
                      </span>
                      <p className="mt-1 text-gray-500">{check.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                          previewRepairAction(
                            candidate.type === 'missing-rating-key'
                              ? 'repair-rating-key'
                              : 'retry-sync',
                            candidate.configId
                          )
                        }
                        className="rounded border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
                        disabled={
                          runningAction ===
                          `preview-${
                            candidate.type === 'missing-rating-key'
                              ? 'repair-rating-key'
                              : 'retry-sync'
                          }-${candidate.configId}`
                        }
                      >
                        {intl.formatMessage(messages.previewRepair)}
                      </button>
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

        {repairPreview && (
          <section className="rounded-md border border-gray-700 p-4">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
              <BoltIcon className="mr-2 h-4 w-4 text-orange-400" />
              {intl.formatMessage(messages.repairPreview)}
            </h4>
            <p className="text-sm font-medium text-gray-200">
              {repairPreview.collection.name}
            </p>
            <div className="mt-2 space-y-2">
              {repairPreview.changes.map((change) => (
                <p
                  key={change}
                  className="rounded bg-stone-900 px-3 py-2 text-xs text-gray-400"
                >
                  {change}
                </p>
              ))}
            </div>
          </section>
        )}

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
            <ExclamationTriangleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.rollbackCandidates)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.rollbackCandidates || []).length ? (
              (intelligence?.rollbackCandidates || []).map((candidate) => (
                <div
                  key={candidate.id}
                  className="rounded bg-stone-900 px-3 py-2"
                >
                  <p className="text-sm font-medium text-gray-200">
                    {candidate.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {candidate.reason}
                  </p>
                  <button
                    type="button"
                    onClick={() => runCollectionRollback(candidate.id)}
                    disabled={runningAction === `rollback-${candidate.id}`}
                    className="mt-2 rounded border border-gray-600 px-2 py-1 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {intl.formatMessage(messages.runRollback)}
                  </button>
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
            <RectangleStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.duplicateFinder)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.duplicateGroups || []).length ? (
              (intelligence?.duplicateGroups || []).map((group) => (
                <div
                  key={group.normalizedName}
                  className="rounded bg-stone-900 px-3 py-2"
                >
                  <p className="text-sm font-medium text-gray-200">
                    {group.normalizedName}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {group.items.map((item) => item.name).join(', ')}
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
            <QuestionMarkCircleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.whyIsThisHere)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.whyCollections || []).slice(0, 6).map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="block rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-900/70"
              >
                <p className="text-sm font-medium text-gray-200">{item.name}</p>
                <p className="mt-1 text-xs text-gray-500">{item.reason}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <LightBulbIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.dashboardWatchlist)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.dashboardWatchlist || []).length ? (
              (intelligence?.dashboardWatchlist || []).map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="block rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-900/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {item.name}
                    </p>
                    <span className="text-xs text-orange-300">
                      {item.score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{item.reason}</p>
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
            {intl.formatMessage(messages.collectionHealthTimeline)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.collectionHealthTimeline || [])
              .slice(0, 6)
              .map((collection) => (
                <div
                  key={collection.id}
                  className="rounded bg-stone-900 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {collection.name}
                    </p>
                    <span
                      className={`text-xs font-semibold ${
                        collection.delta < 0
                          ? 'text-red-300'
                          : collection.delta > 0
                          ? 'text-green-300'
                          : 'text-gray-400'
                      }`}
                    >
                      {collection.latestScore} (
                      {collection.delta >= 0 ? '+' : ''}
                      {collection.delta})
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {collection.history
                      .slice(-5)
                      .map((item) => `${item.date}: ${item.score}`)
                      .join(' / ') || intl.formatMessage(messages.noItems)}
                  </p>
                </div>
              ))}
          </div>
          <a
            href="/api/v1/dashboard/collection-health-snapshots/export?format=csv"
            className="mt-3 inline-block rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.exportHealthCsv)}
          </a>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.sourceHealthTimeline)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.sourceHealthTimeline || [])
              .slice(0, 6)
              .map((source) => (
                <div
                  key={source.sourceId}
                  className="rounded bg-stone-900 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {source.name}
                    </p>
                    <span className="text-xs font-semibold text-orange-300">
                      {source.successRate}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {source.averageLatencyMs} ms avg / {source.history.length}{' '}
                    checks
                  </p>
                </div>
              ))}
          </div>
          <a
            href="/api/v1/dashboard/source-health/export?format=csv"
            className="mt-3 inline-block rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.exportHealthCsv)}
          </a>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <BeakerIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.tautulliDiagnostics)}
          </h4>
          <p className="rounded bg-stone-900 px-3 py-2 text-sm font-semibold text-orange-300">
            {intelligence?.tautulliDiagnostics?.score || 0}% /{' '}
            {intelligence?.tautulliDiagnostics?.recommendation}
          </p>
          <div className="mt-2 space-y-2">
            {(intelligence?.tautulliDiagnostics?.checks || []).map((check) => (
              <div key={check.id} className="rounded bg-stone-900 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-200">
                    {check.title}
                  </p>
                  <span
                    className={`text-xs font-semibold ${
                      check.status === 'attention'
                        ? 'text-red-300'
                        : check.status === 'watch'
                        ? 'text-orange-300'
                        : 'text-green-300'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{check.message}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(intelligence?.tautulliDiagnostics?.endpoints || []).map(
              (endpoint) => (
                <p
                  key={endpoint.id}
                  className={`rounded bg-stone-900 px-3 py-2 text-xs font-semibold ${
                    endpoint.status === 'ok'
                      ? 'text-green-300'
                      : endpoint.status === 'attention'
                      ? 'text-red-300'
                      : 'text-orange-300'
                  }`}
                >
                  {endpoint.label}
                </p>
              )
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <CheckCircleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.preSyncValidator)}
          </h4>
          <p
            className={`rounded bg-stone-900 px-3 py-2 text-sm font-semibold ${
              intelligence?.preSyncValidation?.canSync
                ? 'text-green-300'
                : 'text-red-300'
            }`}
          >
            {intelligence?.preSyncValidation?.canSync
              ? intl.formatMessage(messages.moduleReady)
              : intl.formatMessage(messages.moduleAttention)}
            {' / '}
            {intelligence?.preSyncValidation?.warnings || 0}
          </p>
          <div className="mt-2 space-y-2">
            {(intelligence?.preSyncValidation?.checks || []).map((check) => (
              <div key={check.id} className="rounded bg-stone-900 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-200">
                    {check.title}
                  </p>
                  <span
                    className={`text-xs font-semibold ${
                      check.ok
                        ? 'text-green-300'
                        : check.severity === 'error'
                        ? 'text-red-300'
                        : 'text-orange-300'
                    }`}
                  >
                    {check.ok ? 'ok' : check.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{check.message}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.ghcrImageStatus)}
          </h4>
          <p className="rounded bg-stone-900 px-3 py-2 text-sm font-semibold text-gray-200">
            {intelligence?.ghcrStatus?.image || 'ghcr.io/domigeim/agregarr'}
          </p>
          <div className="mt-2 space-y-2">
            {(intelligence?.ghcrStatus?.tags || []).map((tag) => (
              <div
                key={tag.tag}
                className="flex items-center justify-between rounded bg-stone-900 px-3 py-2"
              >
                <span className="text-sm text-gray-200">{tag.tag}</span>
                <span
                  className={`text-xs font-semibold ${
                    tag.available ? 'text-green-300' : 'text-orange-300'
                  }`}
                >
                  {tag.available ? 'online' : tag.statusCode || 'pending'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.jellyfinHealth)}
          </h4>
          <p
            className={`rounded bg-stone-900 px-3 py-2 text-sm font-semibold ${
              intelligence?.jellyfinHealth?.status === 'attention'
                ? 'text-red-300'
                : intelligence?.jellyfinHealth?.status === 'watch'
                ? 'text-orange-300'
                : 'text-green-300'
            }`}
          >
            {intelligence?.jellyfinHealth?.score || 0}% /{' '}
            {intelligence?.jellyfinHealth?.libraryCount || 0} libraries
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {intelligence?.jellyfinHealth?.message}
          </p>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <ServerStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.embyHealth)}
          </h4>
          <p
            className={`rounded bg-stone-900 px-3 py-2 text-sm font-semibold ${
              intelligence?.embyHealth?.status === 'attention'
                ? 'text-red-300'
                : intelligence?.embyHealth?.status === 'watch'
                ? 'text-orange-300'
                : 'text-green-300'
            }`}
          >
            {intelligence?.embyHealth?.score || 0}% /{' '}
            {intelligence?.embyHealth?.libraryCount || 0} libraries
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {intelligence?.embyHealth?.message}
          </p>
        </section>

        <section className="rounded-md border border-gray-700 p-4">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-white">
            <QuestionMarkCircleIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.whyEmpty)}
          </h4>
          <div className="space-y-2">
            {(intelligence?.emptyCollectionInsights || [])
              .slice(0, 6)
              .map((item) => (
                <a
                  key={item.id}
                  href={`/api/v1/dashboard/collections/${item.id}/why-empty`}
                  className="block rounded bg-stone-900 px-3 py-2 transition-colors hover:bg-stone-900/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {item.name}
                    </p>
                    <span className="text-xs font-semibold text-orange-300">
                      {item.healthScore} / {item.plays}
                    </span>
                  </div>
                  <p className="line-clamp-2 mt-1 text-xs text-gray-500">
                    {item.recommendation}
                  </p>
                </a>
              ))}
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
            <RectangleStackIcon className="mr-2 h-4 w-4 text-orange-400" />
            {intl.formatMessage(messages.overlayOrphans)}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.missingOverlayReferences, {
                count: intelligence?.overlayOrphans?.missingReferenceCount || 0,
              })}
            </p>
            <p className="rounded bg-stone-900 px-3 py-2 text-sm text-gray-300">
              {intl.formatMessage(messages.unusedOverlayTemplates, {
                count: intelligence?.overlayOrphans?.unusedTemplateCount || 0,
              })}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {(intelligence?.overlayOrphans?.missingReferences || [])
              .slice(0, 4)
              .map((item) => (
                <p
                  key={`${item.libraryId}-${item.templateId}`}
                  className="rounded bg-stone-900 px-3 py-2 text-xs text-orange-200"
                >
                  {item.libraryName}: #{item.templateId}
                </p>
              ))}
            {(intelligence?.overlayOrphans?.unusedTemplates || [])
              .slice(0, 4)
              .map((item) => (
                <p
                  key={item.id}
                  className="rounded bg-stone-900 px-3 py-2 text-xs text-gray-400"
                >
                  {item.name} ({item.type})
                </p>
              ))}
          </div>
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
          <button
            type="button"
            onClick={clearDashboardCache}
            disabled={runningAction === 'clear-cache'}
            className="mt-3 rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {intl.formatMessage(messages.clearDashboardCache)}
          </button>
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
          <a
            href="/api/v1/dashboard/health-snapshots/export?format=csv"
            className="mt-3 inline-block rounded border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-orange-500/60"
          >
            {intl.formatMessage(messages.exportHealthCsv)}
          </a>
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
            {intl.formatMessage(messages.collectionConfigExplain)}
          </h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(intelligence?.collectionConfigExplanations || [])
              .slice(0, 8)
              .map((config) => (
                <div
                  key={config.id}
                  className="rounded border border-gray-700 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {config.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {config.type} / {config.libraryName || 'library'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-orange-300">
                      {config.healthScore}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <p className="rounded bg-stone-900 px-2 py-1 text-xs text-gray-300">
                      {config.visibility}
                    </p>
                    <p className="rounded bg-stone-900 px-2 py-1 text-xs text-gray-300">
                      {config.autoRequest
                        ? intl.formatMessage(messages.moduleReady)
                        : intl.formatMessage(messages.moduleWatch)}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {config.syncPlan}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {config.filters.join(' / ') ||
                      intl.formatMessage(messages.noItems)}
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
