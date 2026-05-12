import { v4 as uuidv4 } from 'uuid';
import { queues, ScrapeJob } from '../queue/queues';
import { logger } from '../logger';
import { getDatabase } from '../db/client';

/**
 * Create a scrape job and add it to the pending queue
 */
export const createScrapeJob = async (
  source: 'books' | 'hackernews',
  payload: Record<string, unknown> = {}
): Promise<string> => {
  const jobId = uuidv4();
  const priority = source === 'hackernews' ? 1 : 2;

  const job: ScrapeJob = {
    jobId,
    source,
    createdAt: new Date().toISOString(),
    payload,
    attempt: 1,
    priority,
  };

  try {
    const db = getDatabase();
    await db('scrape_jobs').insert({
      id: jobId,
      source,
      status: 'pending',
      triggered_at: new Date(),
      metadata: payload,
    });

    await queues.pending.add(`scrape-${source}-${jobId}`, job, {
      priority,
      jobId,
    });

    logger.info('Scrape job created', {
      module: 'scheduler',
      jobId,
      source,
      priority,
    });

    return jobId;
  } catch (error) {
    logger.error('Failed to create scrape job', error as Error, {
      module: 'scheduler',
      source,
    });
    throw error;
  }
};

/**
 * Trigger a books scrape job
 */
export const triggerBooksScrape = async (): Promise<string> => {
  const pages = parseInt(process.env.BOOKS_MAX_PAGES || '5', 10);

  logger.info('Triggering books scrape', {
    module: 'scheduler',
    source: 'books',
    pages,
  });

  return createScrapeJob('books', { pages });
};

/**
 * Trigger a Hacker News scrape job
 */
export const triggerHNScrape = async (): Promise<string> => {
  const pages = parseInt(process.env.HN_MAX_PAGES || '2', 10);

  logger.info('Triggering HN scrape', {
    module: 'scheduler',
    source: 'hackernews',
    pages,
  });

  return createScrapeJob('hackernews', { pages });
};
