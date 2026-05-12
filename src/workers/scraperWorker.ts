import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../logger';
import { queues, ScrapeJob, RawDataJob, moveToDLQ, createRedisClient } from '../queue/queues';
import { getDatabase } from '../db/client';
import { scrapeBooks } from './scrapers/booksScraper';
import { scrapeHN } from './scrapers/hnScraper';

/**
 * BullMQ worker for processing scrape jobs
 */
let scraperWorker: Worker | null = null;

/**
 * Process a single scrape job
 */
const processScrapeJob = async (job: Job<ScrapeJob>): Promise<void> => {
  const { jobId, source, payload } = job.data;

  logger.info('Processing scrape job', {
    module: 'scraperWorker',
    jobId,
    source,
    attempt: job.attemptsMade + 1,
  });

  try {
    const db = getDatabase();
    await db('scrape_jobs').where({ id: jobId }).update({
      status: 'processing',
      started_at: new Date(),
    });

    let rawData: unknown;

    if (source === 'books') {
      const pages = (payload.pages as number) || 5;
      rawData = await scrapeBooks(pages);
    } else if (source === 'hackernews') {
      const pages = (payload.pages as number) || 2;
      rawData = await scrapeHN(pages);
    } else {
      throw new Error(`Unknown source: ${source}`);
    }

    logger.info('Scrape job completed', {
      module: 'scraperWorker',
      jobId,
      source,
      itemsScraped: Array.isArray(rawData) ? rawData.length : 0,
    });

    const rawDataJob: RawDataJob = {
      jobId,
      source,
      rawData,
      scrapedAt: new Date().toISOString(),
    };

    await queues.raw.add(`raw-${source}-${jobId}`, rawDataJob, {
      jobId: `raw-${jobId}`,
    });

    await db('scrape_jobs').where({ id: jobId }).update({
      status: 'completed',
      completed_at: new Date(),
    });

    logger.info('Raw data pushed to queue', {
      module: 'scraperWorker',
      jobId,
      source,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Scrape job failed', error as Error, {
      module: 'scraperWorker',
      jobId,
      source,
      attempt: job.attemptsMade + 1,
    });

    const db = getDatabase();
    await db('scrape_jobs').where({ id: jobId }).update({
      status: 'failed',
      completed_at: new Date(),
      error_message: errorMessage,
    });

    if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
      await moveToDLQ(job, error as Error, 'scrape-pending');
    }

    throw error;
  }
};

/**
 * Initialize and start the scraper worker
 */
export const initScraperWorker = (): void => {
  if (scraperWorker) {
    logger.warn('Scraper worker already initialized', { module: 'scraperWorker' });
    return;
  }

  logger.info('Initializing scraper worker...', {
    module: 'scraperWorker',
    concurrency: config.SCRAPER_CONCURRENCY,
  });

  scraperWorker = new Worker<ScrapeJob>(
    'scrape-pending',
    async (job) => {
      await processScrapeJob(job);
    },
    {
      connection: createRedisClient(),
      concurrency: config.SCRAPER_CONCURRENCY,
      limiter: {
        max: config.SCRAPER_CONCURRENCY,
        duration: 1000,
      },
    }
  );

  scraperWorker.on('completed', (job) => {
    logger.info('Scraper job completed', {
      module: 'scraperWorker',
      jobId: job.id,
      source: job.data.source,
    });
  });

  scraperWorker.on('failed', (job, error) => {
    logger.error('Scraper job failed', error, {
      module: 'scraperWorker',
      jobId: job?.id,
      source: job?.data.source,
      attemptsMade: job?.attemptsMade,
    });
  });

  scraperWorker.on('error', (error) => {
    logger.error('Scraper worker error', error, {
      module: 'scraperWorker',
    });
  });

  logger.info('Scraper worker initialized', {
    module: 'scraperWorker',
  });
};

/**
 * Close the scraper worker gracefully
 */
export const closeScraperWorker = async (): Promise<void> => {
  if (!scraperWorker) {
    return;
  }

  logger.info('Closing scraper worker...', { module: 'scraperWorker' });

  try {
    await Promise.race([
      scraperWorker.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Worker close timeout')), 5000)),
    ]);
    scraperWorker = null;
    logger.info('Scraper worker closed', { module: 'scraperWorker' });
  } catch (error) {
    logger.warn('Scraper worker close timeout, forcing', { module: 'scraperWorker' });
    scraperWorker = null;
  }
};

/**
 * Check if scraper worker is running
 */
export const isScraperWorkerRunning = (): boolean => {
  return scraperWorker !== null;
};
