import cron from 'node-cron';
import { config } from '../config';
import { logger } from '../logger';
import { triggerBooksScrape, triggerHNScrape } from './jobFactory';

/**
 * Cron tasks
 */
let booksTask: ReturnType<typeof cron.schedule> | null = null;
let hnTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Initialize and start the scheduler
 */
export const initScheduler = (): void => {
  if (!config.ENABLE_SCHEDULER) {
    logger.info('Scheduler is disabled', { module: 'scheduler' });
    return;
  }

  logger.info('Initializing scheduler...', { module: 'scheduler' });

  // Books scraping schedule (default: daily at 02:00 UTC)
  booksTask = cron.schedule(config.BOOKS_CRON, async () => {
    try {
      logger.info('Books cron job triggered', {
        module: 'scheduler',
        schedule: config.BOOKS_CRON,
      });
      await triggerBooksScrape();
    } catch (error) {
      logger.error('Books cron job failed', error as Error, {
        module: 'scheduler',
      });
    }
  });

  // Hacker News scraping schedule (default: every 15 minutes)
  hnTask = cron.schedule(config.HN_CRON, async () => {
    try {
      logger.info('HN cron job triggered', {
        module: 'scheduler',
        schedule: config.HN_CRON,
      });
      await triggerHNScrape();
    } catch (error) {
      logger.error('HN cron job failed', error as Error, {
        module: 'scheduler',
      });
    }
  });

  logger.info('Scheduler initialized', {
    module: 'scheduler',
    booksSchedule: config.BOOKS_CRON,
    hnSchedule: config.HN_CRON,
  });
};

/**
 * Stop the scheduler
 */
export const stopScheduler = (): void => {
  logger.info('Stopping scheduler...', { module: 'scheduler' });

  if (booksTask) {
    booksTask.stop();
    booksTask = null;
  }

  if (hnTask) {
    hnTask.stop();
    hnTask = null;
  }

  logger.info('Scheduler stopped', { module: 'scheduler' });
};

/**
 * Check if scheduler is running
 */
export const isSchedulerRunning = (): boolean => {
  return booksTask !== null || hnTask !== null;
};
