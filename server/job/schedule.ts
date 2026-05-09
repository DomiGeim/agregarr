// Availability sync import removed - not needed for collections-only app
import collectionsQuickSync from '@server/lib/collectionsQuickSync';
import collectionsSync from '@server/lib/collectionsSync';
// ImageProxy removed - not needed for collections-only app
import overlayApplication from '@server/lib/overlayApplication';
import overlaysQuickSync from '@server/lib/overlaysQuickSync';
import randomizeHomeOrder from '@server/lib/randomizeHomeOrder';
import refreshToken from '@server/lib/refreshToken';
import watchlistSync from '@server/lib/watchlistSync';
// Scanner imports removed - not needed for collections-only app
import type { JobId } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import schedule from 'node-schedule';

interface ScheduledJob {
  id: JobId;
  job: schedule.Job;
  name: string;
  type: 'process' | 'command';
  interval: 'seconds' | 'minutes' | 'hours' | 'fixed';
  cronSchedule: string;
  running?: () => boolean;
  cancelFn?: () => void;
}

export interface JobHistoryItem {
  id: JobId;
  name: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: 'running' | 'success' | 'failed';
  error?: string;
}

export const scheduledJobs: ScheduledJob[] = [];
const jobHistory: JobHistoryItem[] = [];
const MAX_JOB_HISTORY_ITEMS = 50;

const recordJobRun = (item: JobHistoryItem) => {
  jobHistory.unshift(item);
  jobHistory.splice(MAX_JOB_HISTORY_ITEMS);
};

export const getJobHistory = (): JobHistoryItem[] => jobHistory;

const runTrackedJob = async (
  id: JobId,
  name: string,
  task: () => Promise<void> | void
) => {
  const startedAt = new Date();
  const historyItem: JobHistoryItem = {
    id,
    name,
    startedAt: startedAt.toISOString(),
    status: 'running',
  };

  recordJobRun(historyItem);

  try {
    await task();
    historyItem.status = 'success';
  } catch (error) {
    historyItem.status = 'failed';
    historyItem.error = error instanceof Error ? error.message : String(error);
    logger.error('Scheduled job failed', {
      label: 'Jobs',
      jobId: id,
      jobName: name,
      error: historyItem.error,
    });
  } finally {
    const finishedAt = new Date();
    historyItem.finishedAt = finishedAt.toISOString();
    historyItem.durationMs = finishedAt.getTime() - startedAt.getTime();
  }
};

const scheduleTrackedJob = (
  id: JobId,
  name: string,
  cronSchedule: string,
  task: () => Promise<void> | void
) =>
  schedule.scheduleJob(cronSchedule, () => {
    runTrackedJob(id, name, task);
  });

export const startJobs = (): void => {
  const jobs = getSettings().jobs;

  // Plex Recently Added Scan removed - not needed for collections-only app

  // Plex Full Library Scan removed - not needed for collections-only app

  // Radarr Scan removed - not needed for collections-only app

  // Sonarr Scan removed - not needed for collections-only app

  // Media Availability Sync removed - not needed for collections-only app

  scheduledJobs.push({
    id: 'plex-collections-sync',
    name: 'Plex Collections Sync',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['plex-collections-sync'].schedule,
    job: scheduleTrackedJob(
      'plex-collections-sync',
      'Plex Collections Sync',
      jobs['plex-collections-sync'].schedule,
      async () => {
        // Check if any collections are configured before running
        const settings = getSettings();
        const hasCollections =
          settings.plex.collectionConfigs &&
          settings.plex.collectionConfigs.length > 0;

        if (!hasCollections) {
          logger.debug(
            'Skipping scheduled Plex Collections Sync: No collections configured',
            {
              label: 'Jobs',
            }
          );
          return;
        }

        logger.info('Starting scheduled job: Plex Collections Sync', {
          label: 'Jobs',
        });
        await collectionsSync.run();
      }
    ),
    running: () => collectionsSync.status.running,
    cancelFn: () => collectionsSync.cancel(),
  });

  scheduledJobs.push({
    id: 'plex-collections-quick-sync',
    name: 'Collections Quick Sync',
    type: 'process',
    interval: 'minutes',
    cronSchedule: jobs['plex-collections-quick-sync'].schedule,
    job: scheduleTrackedJob(
      'plex-collections-quick-sync',
      'Collections Quick Sync',
      jobs['plex-collections-quick-sync'].schedule,
      async () => {
        logger.info('Starting scheduled job: Collections Quick Sync', {
          label: 'Jobs',
        });
        await collectionsQuickSync.run();
      }
    ),
    running: () => collectionsQuickSync.status.running,
    cancelFn: () => collectionsQuickSync.cancel(),
  });

  scheduledJobs.push({
    id: 'plex-randomize-home-order',
    name: 'Plex Randomize Home Order',
    type: 'process',
    interval: 'minutes',
    cronSchedule: jobs['plex-randomize-home-order'].schedule,
    job: scheduleTrackedJob(
      'plex-randomize-home-order',
      'Plex Randomize Home Order',
      jobs['plex-randomize-home-order'].schedule,
      async () => {
        logger.info('Starting scheduled job: Plex Randomize Home Order', {
          label: 'Jobs',
        });
        await randomizeHomeOrder.run();
      }
    ),
    running: () => randomizeHomeOrder.status.running,
    cancelFn: () => randomizeHomeOrder.cancel(),
  });

  scheduledJobs.push({
    id: 'overlay-application',
    name: 'Overlay Application',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['overlay-application'].schedule,
    job: scheduleTrackedJob(
      'overlay-application',
      'Overlay Application',
      jobs['overlay-application'].schedule,
      async () => {
        logger.info('Starting scheduled job: Overlay Application', {
          label: 'Jobs',
        });
        await overlayApplication.run();
      }
    ),
    running: () => overlayApplication.status.running,
    cancelFn: () => overlayApplication.cancel(),
  });

  scheduledJobs.push({
    id: 'overlay-quick-sync',
    name: 'Overlay Quick Sync',
    type: 'process',
    interval: 'minutes',
    cronSchedule: jobs['overlay-quick-sync'].schedule,
    job: scheduleTrackedJob(
      'overlay-quick-sync',
      'Overlay Quick Sync',
      jobs['overlay-quick-sync'].schedule,
      async () => {
        logger.info('Starting scheduled job: Overlay Quick Sync', {
          label: 'Jobs',
        });
        await overlaysQuickSync.run();
      }
    ),
    running: () => overlaysQuickSync.status.running,
    cancelFn: () => overlaysQuickSync.cancel(),
  });

  scheduledJobs.push({
    id: 'plex-refresh-token',
    name: 'Plex Refresh Token',
    type: 'process',
    interval: 'fixed',
    cronSchedule: jobs['plex-refresh-token'].schedule,
    job: scheduleTrackedJob(
      'plex-refresh-token',
      'Plex Refresh Token',
      jobs['plex-refresh-token'].schedule,
      async () => {
        logger.info('Starting scheduled job: Plex Refresh Token', {
          label: 'Jobs',
        });
        await refreshToken.run();
      }
    ),
  });

  scheduledJobs.push({
    id: 'watchlist-sync',
    name: 'Plex Watchlist Sync',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['watchlist-sync'].schedule,
    job: scheduleTrackedJob(
      'watchlist-sync',
      'Plex Watchlist Sync',
      jobs['watchlist-sync'].schedule,
      async () => {
        // Check if watchlist sync is enabled
        const settings = getSettings();
        const syncSettings = settings.watchlistSync;

        if (!syncSettings.enableOwner && !syncSettings.enableUsers) {
          logger.debug('Skipping scheduled Watchlist Sync: Not enabled', {
            label: 'Jobs',
          });
          return;
        }

        logger.info('Starting scheduled job: Plex Watchlist Sync', {
          label: 'Jobs',
        });
        await watchlistSync.run();
      }
    ),
    running: () => watchlistSync.status.running,
    cancelFn: () => watchlistSync.cancel(),
  });

  logger.info('Scheduled jobs loaded', { label: 'Jobs' });
};
