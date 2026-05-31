import Spinner from '@app/assets/spinner.svg';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import { OverlayEditorModal } from '@app/components/OverlayEditor';
import {
  ArrowUpTrayIcon,
  BeakerIcon,
  CheckIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  PlayIcon,
  PlusIcon,
  StopIcon,
} from '@heroicons/react/24/solid';
import type {
  ApplicationCondition,
  OverlayTemplateData,
  OverlayTemplateType,
} from '@server/entity/OverlayTemplate';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import LibraryConfigView from './LibraryConfigView';
import OverlayTemplateGrid from './OverlayTemplateGrid';
import PosterSourceSetupModal from './PosterSourceSetupModal';
import TestItemModal from './TestItemModal';

const messages = defineMessages({
  overlaySystemTitle: 'Overlay System',
  overlaySystemDescription:
    'Create overlay templates and apply them to your Plex library posters',
  templatesTab: 'Overlay Templates',
  librariesTab: 'Library Configuration',
  createOverlayTemplate: 'Create Overlay Template',
  importTemplate: 'Import Template',
  overlayImportSuccess: 'Overlay template imported successfully',
  overlayImportError: 'Failed to import overlay template',
  overlayLoadError: 'Failed to load overlay data',
  overlayTemplatesDescription:
    'Design reusable overlay templates for ratings, metadata, and more',
  librariesDescription: 'Configure which overlays are applied to each library',
  overlaySettings: 'Posters Source',
  fullOverlaysSync: 'Full Overlays Sync',
  fullOverlaysSyncConfirm: 'Confirm Full Sync?',
  fullOverlaySyncStarted: 'Full overlay sync started',
  overlaySyncQueued:
    'Per-library syncs are running. Full sync will start when they complete.',
  overlaySyncError: 'Failed to start overlay sync',
  overlayJobs: 'Overlay Jobs',
  libraryProgress: 'Library {current} of {total}',
  inProgress: 'In Progress',
  processing: 'Processing',
  itemProgress: 'Item {current} of {total}',
  progress: 'Progress',
  success: 'Success',
  errors: 'Errors',
  unchanged: 'Unchanged',
  filtered: 'Filtered',
  processed: 'Processed {processed} / {total}',
  eta: 'ETA: {time}',
  stop: 'Stop',
  noOverlayJobs: 'No overlay jobs running',
  testItem: 'Test Item',
  allTags: 'All',
  showDefaultTemplates: 'Show default templates',
  recentItems: 'Recent items',
  recentErrors: 'Recent errors',
});

interface OverlayTemplate {
  id: number;
  name: string;
  description?: string;
  type: OverlayTemplateType;
  templateData: OverlayTemplateData;
  isDefault: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

type TabKey = 'templates' | 'libraries';

interface OverlayApplicationStatus {
  running: boolean;
  cancelled: boolean;
  currentStage: string;
  totalLibraries: number;
  processedLibraries: number;
  currentLibraryIndex: number;
  currentLibraryName: string;
  progress: number;
  currentLibraryProgress?: {
    libraryId: string;
    libraryName: string;
    totalItems: number;
    processedItems: number;
    successCount: number;
    errorCount: number;
    unchangedCount: number;
    filteredCount: number;
    currentItemTitle?: string;
    currentItemIndex?: number;
    recentItems?: {
      title: string;
      outcome: 'success' | 'unchanged' | 'filtered' | 'error';
    }[];
    recentErrors?: {
      title: string;
      message: string;
    }[];
    progress: number;
    etaSeconds?: number;
  };
}

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds <= 0) {
    return '0s';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
};

const OverlaysPageView: React.FC = () => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();

  // Get active tab from query param, default to 'templates'
  const activeTab = (router.query.tab as TabKey) || 'templates';
  const isLibrariesTab = activeTab === 'libraries';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [fullSyncConfirmClicked, setFullSyncConfirmClicked] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showDefaultTemplates, setShowDefaultTemplates] = useState(true);
  const [gridSize, setGridSize] = useState<'xs' | 'small' | 'medium' | 'large'>(
    () => {
      // Load from localStorage if available
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('overlayGridSize');
        if (
          saved === 'xs' ||
          saved === 'small' ||
          saved === 'medium' ||
          saved === 'large'
        ) {
          return saved;
        }
      }
      return 'medium';
    }
  );
  const fullSyncConfirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save grid size to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('overlayGridSize', gridSize);
  }, [gridSize]);

  const handleTabChange = (tab: TabKey) => {
    router.push({ pathname: router.pathname, query: { tab } }, undefined, {
      shallow: true,
    });
  };

  // Poll jobs to check if overlay-application is running
  const { data: jobsData } = useSWR<{ id: string; running: boolean }[]>(
    '/api/v1/settings/jobs',
    {
      refreshInterval: 3000,
    }
  );

  // Poll for running library overlays
  const { data: runningLibrariesData } = useSWR<{
    runningLibraries: {
      libraryId: string;
      libraryName: string;
      progress?: OverlayApplicationStatus['currentLibraryProgress'];
    }[];
  }>(isLibrariesTab ? '/api/v1/overlay-library-configs/status/all' : null, {
    refreshInterval: 3000,
  });

  const { data: overlayApplicationStatus, mutate: mutateApplicationStatus } =
    useSWR<OverlayApplicationStatus>(
      '/api/v1/overlay-settings/application-status',
      {
        refreshInterval: 2000,
      }
    );

  const isOverlaySyncRunning =
    overlayApplicationStatus?.running ??
    jobsData?.find((job) => job.id === 'overlay-application')?.running ??
    false;
  const hasRunningLibraries =
    (runningLibrariesData?.runningLibraries.length ?? 0) > 0;

  const handleStopOverlayApplication = async () => {
    try {
      await axios.post('/api/v1/overlay-settings/cancel-application');
      mutateApplicationStatus();
    } catch (error) {
      addToast(intl.formatMessage(messages.overlaySyncError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  // Clear confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (fullSyncConfirmTimeoutRef.current) {
        clearTimeout(fullSyncConfirmTimeoutRef.current);
      }
    };
  }, []);

  // Fetch overlay templates
  const {
    data: templatesData,
    error: templatesError,
    mutate: mutateTemplates,
  } = useSWR<{ templates: OverlayTemplate[] }>('/api/v1/overlay-templates');

  // Fetch overlay settings
  const { data: overlaySettings, mutate: mutateSettings } = useSWR<{
    defaultPosterSource: 'tmdb' | 'plex';
    initialSetupComplete: boolean;
  }>('/api/v1/overlay-settings');

  const templates = useMemo(
    () => templatesData?.templates || [],
    [templatesData?.templates]
  );
  const visibleTemplates = useMemo(
    () =>
      showDefaultTemplates
        ? templates
        : templates.filter((template) => !template.isDefault),
    [showDefaultTemplates, templates]
  );

  // Extract unique tags from all templates
  const uniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    visibleTemplates.forEach((template) => {
      template.tags?.forEach((tag) => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [visibleTemplates]);

  // Count templates per tag
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    uniqueTags.forEach((tag) => {
      counts[tag] = visibleTemplates.filter((t) =>
        t.tags?.includes(tag)
      ).length;
    });
    return counts;
  }, [uniqueTags, visibleTemplates]);

  // Show setup modal when navigating to Library Configuration tab if setup not complete
  useEffect(() => {
    if (
      isLibrariesTab &&
      overlaySettings &&
      !overlaySettings.initialSetupComplete
    ) {
      setIsSetupModalOpen(true);
    }
  }, [isLibrariesTab, overlaySettings]);

  const handleSetupComplete = () => {
    setIsSetupModalOpen(false);
    mutateSettings();
  };

  const handleCreateTemplate = () => {
    setIsModalOpen(true);
  };

  const handleImportTemplate = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!file.name.endsWith('.zip')) {
        throw new Error(
          'Invalid file type. Please upload a ZIP file containing an overlay template.'
        );
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/uploads/overlay-template', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      mutateTemplates();
      addToast(intl.formatMessage(messages.overlayImportSuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : intl.formatMessage(messages.overlayImportError),
        {
          appearance: 'error',
          autoDismiss: true,
        }
      );
    }

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleSave = async (data: {
    name: string;
    description?: string;
    type?: string;
    templateData: OverlayTemplateData;
    applicationCondition?: ApplicationCondition;
    tags?: string[];
  }) => {
    const response = await fetch('/api/v1/overlay-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        type: data.type || 'generic',
        templateData: data.templateData,
        applicationCondition: data.applicationCondition,
        tags: data.tags,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create template');
    }

    mutateTemplates();
    addToast('Template created successfully', {
      appearance: 'success',
      autoDismiss: true,
    });
  };

  const handleFullOverlaysSync = async () => {
    // First click - show confirmation
    if (!fullSyncConfirmClicked) {
      setFullSyncConfirmClicked(true);
      // Reset after 3 seconds
      fullSyncConfirmTimeoutRef.current = setTimeout(() => {
        setFullSyncConfirmClicked(false);
      }, 3000);
      return;
    }

    // Second click - execute sync
    if (fullSyncConfirmTimeoutRef.current) {
      clearTimeout(fullSyncConfirmTimeoutRef.current);
    }
    setFullSyncConfirmClicked(false);

    try {
      // Check if per-library syncs are running
      if (hasRunningLibraries) {
        addToast(intl.formatMessage(messages.overlaySyncQueued), {
          appearance: 'info',
          autoDismiss: true,
        });
      }

      await axios.post('/api/v1/settings/jobs/overlay-application/run');
      mutateApplicationStatus();

      // Show different message if queued vs started immediately
      if (!hasRunningLibraries) {
        addToast(intl.formatMessage(messages.fullOverlaySyncStarted), {
          appearance: 'success',
          autoDismiss: true,
        });
      }
    } catch (error) {
      addToast(intl.formatMessage(messages.overlaySyncError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const tabs: {
    key: TabKey;
    name: string;
    count?: number;
    description: string;
    icon?: React.ReactNode;
  }[] = [
    {
      key: 'templates',
      name: intl.formatMessage(messages.templatesTab),
      count: visibleTemplates.length,
      description: intl.formatMessage(messages.overlayTemplatesDescription),
    },
    {
      key: 'libraries',
      name: intl.formatMessage(messages.librariesTab),
      count: undefined,
      description: intl.formatMessage(messages.librariesDescription),
      icon: <Cog6ToothIcon className="h-4 w-4" />,
    },
  ];

  const currentTabData = tabs.find((t) => t.key === activeTab) || tabs[0];
  const currentJobProgress = overlayApplicationStatus?.currentLibraryProgress;
  const libraryProgressCurrent =
    overlayApplicationStatus?.currentLibraryIndex ||
    overlayApplicationStatus?.processedLibraries ||
    0;
  const libraryProgressTotal = overlayApplicationStatus?.totalLibraries || 0;
  const activeJobName =
    currentJobProgress?.libraryName ||
    overlayApplicationStatus?.currentLibraryName ||
    overlayApplicationStatus?.currentStage?.replace(
      'Applying overlays to library: ',
      ''
    ) ||
    intl.formatMessage(messages.overlayJobs);
  const showOverlayJobsPanel =
    (overlayApplicationStatus?.running ||
      !!overlayApplicationStatus?.currentLibraryProgress);

  const renderOverlayJobsPanel = () => {
    if (!showOverlayJobsPanel) {
      return null;
    }

    const progress = currentJobProgress?.progress ?? 0;
    const processedItems = currentJobProgress?.processedItems ?? 0;
    const totalItems = currentJobProgress?.totalItems ?? 0;

    return (
      <section className="rounded-lg border-2 border-orange-600 bg-stone-900/60 p-6 shadow-lg">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-bold text-white">
                {intl.formatMessage(messages.overlayJobs)}
              </h3>
              {libraryProgressTotal > 0 && (
                <span className="text-sm text-stone-400">
                  {intl.formatMessage(messages.libraryProgress, {
                    current: libraryProgressCurrent,
                    total: libraryProgressTotal,
                  })}
                </span>
              )}
            </div>
            <div className="mt-8">
              <h4 className="text-2xl font-bold text-white">
                {activeJobName.replace(/\.\.\.$/, '').trim()}
              </h4>
              <p className="mt-1 text-sm font-medium text-stone-400">
                {intl.formatMessage(messages.inProgress)}
              </p>
            </div>
          </div>
          <Button
            buttonType="danger"
            onClick={handleStopOverlayApplication}
            className="flex items-center gap-2"
          >
            <StopIcon className="h-4 w-4" />
            <span>{intl.formatMessage(messages.stop)}</span>
          </Button>
        </div>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span className="text-stone-200">
              {intl.formatMessage(messages.progress)}
            </span>
            <span className="text-stone-300">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-stone-700">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mb-5 rounded-md bg-black/30 px-4 py-4">
          <p className="text-sm text-stone-500">
            {intl.formatMessage(messages.processing)}
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {currentJobProgress?.currentItemTitle || '-'}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {intl.formatMessage(messages.itemProgress, {
              current: currentJobProgress?.currentItemIndex || processedItems,
              total: totalItems,
            })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-md bg-black/30 p-4">
            <p className="flex items-center gap-2 text-sm text-stone-300">
              <CheckIcon className="h-5 w-5 text-green-400" />
              {intl.formatMessage(messages.success)}
            </p>
            <p className="mt-3 text-2xl font-bold text-green-400">
              {currentJobProgress?.successCount || 0}
            </p>
          </div>
          <div className="rounded-md bg-black/30 p-4">
            <p className="flex items-center gap-2 text-sm text-stone-300">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              {intl.formatMessage(messages.errors)}
            </p>
            <p className="mt-3 text-2xl font-bold text-red-400">
              {currentJobProgress?.errorCount || 0}
            </p>
          </div>
          <div className="rounded-md bg-black/30 p-4">
            <p className="flex items-center gap-2 text-sm text-stone-300">
              <PlayIcon className="h-5 w-5 text-yellow-400" />
              {intl.formatMessage(messages.unchanged)}
            </p>
            <p className="mt-3 text-2xl font-bold text-yellow-400">
              {currentJobProgress?.unchangedCount || 0}
            </p>
          </div>
          <div className="rounded-md bg-black/30 p-4">
            <p className="flex items-center gap-2 text-sm text-stone-300">
              <FunnelIcon className="h-5 w-5 text-blue-400" />
              {intl.formatMessage(messages.filtered)}
            </p>
            <p className="mt-3 text-2xl font-bold text-blue-400">
              {currentJobProgress?.filteredCount || 0}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-400">
          <span>
            {intl.formatMessage(messages.processed, {
              processed: processedItems,
              total: totalItems,
            })}
          </span>
          {currentJobProgress?.etaSeconds !== undefined && (
            <span>
              {intl.formatMessage(messages.eta, {
                time: formatDuration(currentJobProgress.etaSeconds),
              })}
            </span>
          )}
        </div>
        {!!currentJobProgress?.recentItems?.length && (
          <div className="mt-5 rounded-md bg-black/30 px-4 py-4">
            <p className="mb-3 text-sm font-semibold text-stone-200">
              {intl.formatMessage(messages.recentItems)}
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {currentJobProgress.recentItems.slice(0, 8).map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="flex items-center justify-between gap-3 rounded bg-stone-950/60 px-3 py-2 text-sm"
                >
                  <span className="truncate text-stone-300">{item.title}</span>
                  <span
                    className={
                      item.outcome === 'success'
                        ? 'text-green-400'
                        : item.outcome === 'error'
                        ? 'text-red-400'
                        : item.outcome === 'filtered'
                        ? 'text-blue-400'
                        : 'text-yellow-400'
                    }
                  >
                    {item.outcome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!!currentJobProgress?.recentErrors?.length && (
          <div className="mt-5 rounded-md border border-red-500/30 bg-red-950/20 px-4 py-4">
            <p className="mb-3 text-sm font-semibold text-red-200">
              {intl.formatMessage(messages.recentErrors)}
            </p>
            <div className="space-y-2">
              {currentJobProgress.recentErrors.slice(0, 6).map((item, index) => (
                <p
                  key={`${item.title}-${index}`}
                  className="text-sm text-red-300"
                >
                  <span className="font-semibold">{item.title}:</span>{' '}
                  {item.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  };

  if (templatesError) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-red-400">
          {intl.formatMessage(messages.overlayLoadError)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          {intl.formatMessage(messages.overlaySystemTitle)}
        </h2>
        <p className="mt-1 text-sm text-stone-400">
          {intl.formatMessage(messages.overlaySystemDescription)}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex space-x-1 rounded-xl bg-stone-900/20 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium leading-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-75 ${
                activeTab === tab.key
                  ? 'border border-orange-500 bg-orange-500 bg-opacity-80 text-white shadow'
                  : 'border border-stone-600 text-stone-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="flex items-center">
                {tab.icon && <span className="mr-2">{tab.icon}</span>}
                <span>{tab.name}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-bold leading-none ${
                      activeTab === tab.key
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-stone-700 text-stone-200'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="flex items-center space-x-2">
            <label className="mr-2 flex items-center text-sm text-stone-200">
              <input
                type="checkbox"
                checked={showDefaultTemplates}
                onChange={() => setShowDefaultTemplates((value) => !value)}
                className="mr-2"
              />
              {intl.formatMessage(messages.showDefaultTemplates)}
            </label>
            {/* Grid size control */}
            <div className="flex items-center rounded-md border border-stone-600 bg-stone-800 text-xs font-medium">
              {(['xs', 'small', 'medium', 'large'] as const).map(
                (size, index) => (
                  <button
                    key={size}
                    onClick={() => setGridSize(size)}
                    className={`px-2 py-1.5 transition-colors ${
                      gridSize === size
                        ? 'bg-orange-600 text-white'
                        : 'text-stone-400 hover:bg-stone-700 hover:text-white'
                    } ${index === 0 ? 'rounded-l-md' : ''} ${
                      index === 3 ? 'rounded-r-md' : ''
                    }`}
                    title={`${
                      size.charAt(0).toUpperCase() + size.slice(1)
                    } grid`}
                  >
                    {size === 'xs'
                      ? 'XS'
                      : size === 'small'
                      ? 'S'
                      : size === 'medium'
                      ? 'M'
                      : 'L'}
                  </button>
                )
              )}
            </div>
            <Button
              buttonType="ghost"
              onClick={() => setIsTestModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <BeakerIcon className="h-4 w-4" />
              <span>{intl.formatMessage(messages.testItem)}</span>
            </Button>
            <Button
              buttonType="ghost"
              onClick={handleImportTemplate}
              className="flex items-center space-x-2"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              <span>{intl.formatMessage(messages.importTemplate)}</span>
            </Button>
            <Button
              buttonType="primary"
              onClick={handleCreateTemplate}
              className="flex items-center space-x-2"
            >
              <PlusIcon className="h-4 w-4" />
              <span>{intl.formatMessage(messages.createOverlayTemplate)}</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {activeTab === 'libraries' && (
          <div className="flex items-center space-x-2">
            <Button
              buttonType="ghost"
              onClick={() => setIsSetupModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <Cog6ToothIcon className="h-5 w-5" />
              <span>{intl.formatMessage(messages.overlaySettings)}</span>
            </Button>
            <Button
              buttonType={fullSyncConfirmClicked ? 'warning' : 'primary'}
              onClick={handleFullOverlaysSync}
              disabled={isOverlaySyncRunning}
              className="flex items-center space-x-2"
            >
              {isOverlaySyncRunning ? (
                <Spinner className="h-4 w-4" />
              ) : fullSyncConfirmClicked ? (
                <ExclamationTriangleIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              <span>
                {fullSyncConfirmClicked
                  ? intl.formatMessage(messages.fullOverlaysSyncConfirm)
                  : intl.formatMessage(messages.fullOverlaysSync)}
              </span>
            </Button>
          </div>
        )}
      </div>

      {/* Tab description */}
      <div className="mt-2 text-sm text-stone-400">
        {currentTabData.description}
      </div>

      {renderOverlayJobsPanel()}

      {/* Tab content */}
      {activeTab === 'templates' && (
        <>
          {/* Tag filter tabs */}
          {uniqueTags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  selectedTag === null
                    ? 'bg-orange-600 text-white'
                    : 'bg-stone-700 text-stone-300 hover:bg-stone-600 hover:text-white'
                }`}
              >
                {intl.formatMessage(messages.allTags)} (
                {visibleTemplates.length})
              </button>
              {uniqueTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    selectedTag === tag
                      ? 'bg-orange-600 text-white'
                      : 'bg-stone-700 text-stone-300 hover:bg-stone-600 hover:text-white'
                  }`}
                >
                  {tag} ({tagCounts[tag]})
                </button>
              ))}
            </div>
          )}
          {!templatesData ? (
            <div className="flex h-96 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <OverlayTemplateGrid
              templates={visibleTemplates}
              onTemplateUpdate={mutateTemplates}
              selectedTag={selectedTag}
              gridSize={gridSize}
            />
          )}
        </>
      )}

      {activeTab === 'libraries' && <LibraryConfigView />}

      <OverlayEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="create"
        onSave={handleSave}
      />

      <PosterSourceSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onComplete={handleSetupComplete}
        isInitialSetup={!overlaySettings?.initialSetupComplete}
        currentPosterSource={overlaySettings?.defaultPosterSource}
      />

      <TestItemModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </div>
  );
};

export default OverlaysPageView;
