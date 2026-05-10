import { Worker, Job } from 'bullmq';
import { queues, ProcessedDataJob } from '../queue/queues';
import { upsertBooks, upsertHNStories } from './upsert';
import { ProcessedDataJobSchema, CleanBook, CleanHNStory } from '../types/schemas';
import { getDatabase } from '../db/client';
import { logger } from '../logger';

/**
 * Persister worker configuration
 */
const PERSISTER_CONCURRENCY = parseInt(process.env.PERSISTER_CONCURRENCY || '2', 10);

/**
 * Worker instance
 */
let persisterWorker: Worker<ProcessedDataJob> | null = null;

/**
 * Update scrape_jobs table status
 */
async function updateJobStatus(
  jobId: string,
  status: 'completed' | 'failed',
  error?: string
): Promise<void> {
  const db = getDatabase();

  try {
    const update: Record<string, any> = {
      status,
      completed_at: db.fn.now(),
    };

    if (error) {
      update.error_message = error;
    }

    await db('scrape_jobs').where({ id: jobId }).update(update); // Fixed: use 'id' instead of 'job_id'

    logger.debug('Updated scrape_jobs status', {
      module: 'persisterWorker',
      jobId,
      status,
    });
  } catch (err) {
    logger.error('Failed to update scrape_jobs status', err as Error, {
      module: 'persisterWorker',
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Process processed data job and persist to database
 */
async function processPersistJob(job: Job<ProcessedDataJob>): Promise<void> {
  const jobId = job.data.jobId;
  const source = job.data.source;

  logger.info('Starting persistence', {
    module: 'persisterWorker',
    jobId,
    source,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Validate job data
    const validatedJob = ProcessedDataJobSchema.parse(job.data);

    // Persist based on source
    let rowsAffected = 0;

    if (source === 'books') {
      const books = validatedJob.cleanData as CleanBook[];

      logger.debug('Persisting books', {
        module: 'persisterWorker',
        jobId,
        count: books.length,
      });

      rowsAffected = await upsertBooks(books);

      logger.info('Books persisted successfully', {
        module: 'persisterWorker',
        jobId,
        source,
        count: books.length,
        rowsAffected,
      });
    } else if (source === 'hackernews') {
      const stories = validatedJob.cleanData as CleanHNStory[];

      logger.debug('Persisting HN stories', {
        module: 'persisterWorker',
        jobId,
        count: stories.length,
      });

      rowsAffected = await upsertHNStories(stories);

      logger.info('HN stories persisted successfully', {
        module: 'persisterWorker',
        jobId,
        source,
        count: stories.length,
        rowsAffected,
      });
    } else {
      throw new Error(`Unknown source: ${source}`);
    }

    // Update scrape_jobs status
    await updateJobStatus(jobId, 'completed');

    logger.info('Persistence completed', {
      module: 'persisterWorker',
      jobId,
      source,
      rowsAffected,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    logger.error('Persistence failed', error as Error, {
      module: 'persisterWorker',
      jobId,
      source,
      attempt: job.attemptsMade + 1,
      error: errorMsg,
      stackTrace,
    });

    // Check if this is the last attempt
    if (job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
      // Update scrape_jobs status
      await updateJobStatus(jobId, 'failed', errorMsg);

      // Move to DLQ
      await queues.dlq.add(`dlq-persist-${jobId}`, {
        originalJobId: jobId,
        source,
        failedQueue: 'scrape:processed',
        error: errorMsg,
        stackTrace,
        payload: job.data,
        failedAt: new Date().toISOString(),
        attempts: job.attemptsMade + 1,
      });

      logger.error('Job moved to DLQ after max retries', undefined as any, {
        module: 'persisterWorker',
        jobId,
        source,
        attempts: job.attemptsMade + 1,
      });
    }

    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

/**
 * Create and start persister worker
 */
export function createPersisterWorker(): Worker<ProcessedDataJob> {
  if (persisterWorker) {
    logger.warn('Persister worker already initialized', {
      module: 'persisterWorker',
    });
    return persisterWorker;
  }

  const worker = new Worker<ProcessedDataJob>(
    'scrape-processed',
    async (job) => {
      await processPersistJob(job);
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      },
      concurrency: PERSISTER_CONCURRENCY,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    }
  );

  // Event listeners
  worker.on('ready', () => {
    logger.info('Persister worker ready', {
      module: 'persisterWorker',
      concurrency: PERSISTER_CONCURRENCY,
    });
  });

  worker.on('active', (job) => {
    logger.debug('Job active', {
      module: 'persisterWorker',
      jobId: job.data.jobId,
      source: job.data.source,
    });
  });

  worker.on('completed', (job) => {
    logger.info('Job completed', {
      module: 'persisterWorker',
      jobId: job.data.jobId,
      source: job.data.source,
    });
  });

  worker.on('failed', (job, error) => {
    if (job) {
      logger.error('Job failed', error as Error, {
        module: 'persisterWorker',
        jobId: job.data.jobId,
        source: job.data.source,
        error: error.message,
      });
    }
  });

  worker.on('error', (error) => {
    logger.error('Worker error', error as Error, {
      module: 'persisterWorker',
      error: error.message,
    });
  });

  persisterWorker = worker;
  return worker;
}

/**
 * Close persister worker gracefully
 */
export async function closePersisterWorker(): Promise<void> {
  if (!persisterWorker) {
    return;
  }

  logger.info('Closing persister worker...', {
    module: 'persisterWorker',
  });

  try {
    await Promise.race([
      persisterWorker.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Worker close timeout')), 5000)),
    ]);
    persisterWorker = null;

    logger.info('Persister worker closed', {
      module: 'persisterWorker',
    });
  } catch (error) {
    logger.warn('Persister worker close timeout, forcing', {
      module: 'persisterWorker',
    });
    persisterWorker = null;
  }
}
