import { Worker, Job } from 'bullmq';
import { queues, RawDataJob } from '../queue/queues';
import { transformBooks } from './bookTransformer';
import { transformHNStories } from './hnTransformer';
import { RawDataJobSchema } from '../types/schemas';
import { logger } from '../logger';

/**
 * Transformer worker configuration
 */
const TRANSFORMER_CONCURRENCY = parseInt(process.env.TRANSFORMER_CONCURRENCY || '5', 10);

/**
 * Worker instance
 */
let transformerWorker: Worker<RawDataJob> | null = null;

/**
 * Process raw data job and transform it
 */
async function processTransformJob(job: Job<RawDataJob>): Promise<void> {
  const jobId = job.data.jobId;
  const source = job.data.source;

  logger.info('Starting transformation', {
    module: 'transformerWorker',
    jobId,
    source,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Validate job data
    const validatedJob = RawDataJobSchema.parse(job.data);

    // Transform based on source
    let cleanData: Array<
      import('../types/schemas').CleanBook | import('../types/schemas').CleanHNStory
    >;

    if (source === 'books') {
      logger.debug('Transforming books data', {
        module: 'transformerWorker',
        jobId,
        rawCount: validatedJob.rawData.length,
      });

      const books = transformBooks(validatedJob.rawData);
      cleanData = books;

      logger.info('Books transformation completed', {
        module: 'transformerWorker',
        jobId,
        source,
        cleanCount: books.length,
      });
    } else if (source === 'hackernews') {
      logger.debug('Transforming HN stories data', {
        module: 'transformerWorker',
        jobId,
        rawCount: validatedJob.rawData.length,
      });

      const stories = transformHNStories(validatedJob.rawData);
      cleanData = stories;

      logger.info('HN stories transformation completed', {
        module: 'transformerWorker',
        jobId,
        source,
        cleanCount: stories.length,
      });
    } else {
      throw new Error(`Unknown source: ${source}`);
    }

    // Push to processed queue
    await queues.processed.add(
      `process-${source}-${jobId}`,
      {
        jobId,
        source,
        cleanData,
        transformedAt: new Date().toISOString(),
      },
      {
        priority: source === 'hackernews' ? 1 : 2,
      }
    );

    logger.info('Pushed to processed queue', {
      module: 'transformerWorker',
      jobId,
      source,
      nextQueue: 'scrape:processed',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    logger.error('Transformation failed', error as Error, {
      module: 'transformerWorker',
      jobId,
      source,
      attempt: job.attemptsMade + 1,
      error: errorMsg,
      stackTrace,
    });

    // Check if this is the last attempt
    if (job.attemptsMade + 1 >= (job.opts.attempts || 2)) {
      // Move to DLQ
      await queues.dlq.add(`dlq-transform-${jobId}`, {
        originalJobId: jobId,
        source,
        failedQueue: 'scrape:raw',
        error: errorMsg,
        stackTrace,
        payload: job.data,
        failedAt: new Date().toISOString(),
        attempts: job.attemptsMade + 1,
      });

      logger.error('Job moved to DLQ after max retries', undefined as any, {
        module: 'transformerWorker',
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
 * Create and start transformer worker
 */
export function createTransformerWorker(): Worker<RawDataJob> {
  if (transformerWorker) {
    logger.warn('Transformer worker already initialized', {
      module: 'transformerWorker',
    });
    return transformerWorker;
  }

  const worker = new Worker<RawDataJob>(
    'scrape-raw',
    async (job) => {
      await processTransformJob(job);
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      },
      concurrency: TRANSFORMER_CONCURRENCY,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    }
  );

  // Event listeners
  worker.on('ready', () => {
    logger.info('Transformer worker ready', {
      module: 'transformerWorker',
      concurrency: TRANSFORMER_CONCURRENCY,
    });
  });

  worker.on('active', (job) => {
    logger.debug('Job active', {
      module: 'transformerWorker',
      jobId: job.data.jobId,
      source: job.data.source,
    });
  });

  worker.on('completed', (job) => {
    logger.info('Job completed', {
      module: 'transformerWorker',
      jobId: job.data.jobId,
      source: job.data.source,
    });
  });

  worker.on('failed', (job, error) => {
    if (job) {
      logger.error('Job failed', error, {
        module: 'transformerWorker',
        jobId: job.data.jobId,
        source: job.data.source,
      });
    }
  });

  worker.on('error', (error) => {
    logger.error('Worker error', error, {
      module: 'transformerWorker',
    });
  });

  transformerWorker = worker;
  return worker;
}

/**
 * Close transformer worker gracefully
 */
export async function closeTransformerWorker(): Promise<void> {
  if (!transformerWorker) {
    return;
  }

  logger.info('Closing transformer worker...', {
    module: 'transformerWorker',
  });

  try {
    await Promise.race([
      transformerWorker.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Worker close timeout')), 5000)),
    ]);
    transformerWorker = null;

    logger.info('Transformer worker closed', {
      module: 'transformerWorker',
    });
  } catch (error) {
    logger.warn('Transformer worker close timeout, forcing', {
      module: 'transformerWorker',
    });
    transformerWorker = null;
  }
}
