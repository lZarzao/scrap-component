import { Queue, QueueOptions, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logger';
import type { ProcessedDataJob as ProcessedDataJobType } from '../types/schemas';

/**
 * Job types
 */
export interface ScrapeJob {
  jobId: string;
  source: 'books' | 'hackernews';
  createdAt: string;
  payload: Record<string, unknown>;
  attempt: number;
  priority?: 1 | 2;
}

export interface RawDataJob {
  jobId: string;
  source: 'books' | 'hackernews';
  rawData: unknown;
  scrapedAt?: string;
}

export type ProcessedDataJob = ProcessedDataJobType;

export interface DLQJob {
  originalJobId: string;
  source: string;
  failedQueue: string;
  error: string;
  stackTrace?: string;
  payload: unknown;
  failedAt: string;
  attempts: number;
}

/**
 * Redis connection configuration
 */
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Create Redis client for BullMQ
 */
export const createRedisClient = (): Redis => {
  return new Redis(redisConnection);
};

/**
 * Base queue options
 */
const baseQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Remove after 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // Remove after 7 days
    },
  },
};

/**
 * Queue instances
 */
export const queues = {
  pending: new Queue<ScrapeJob>('scrape-pending', {
    ...baseQueueOptions,
    defaultJobOptions: {
      ...baseQueueOptions.defaultJobOptions,
      attempts: 3, // Retry 3 times
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2s, then 4s, 8s
      },
    },
  }),

  raw: new Queue<RawDataJob>('scrape-raw', {
    ...baseQueueOptions,
    defaultJobOptions: {
      ...baseQueueOptions.defaultJobOptions,
      attempts: 2, // Retry 1 time (total 2 attempts)
      backoff: {
        type: 'fixed',
        delay: 1000, // 1s delay
      },
    },
  }),

  processed: new Queue<ProcessedDataJob>('scrape-processed', {
    ...baseQueueOptions,
    defaultJobOptions: {
      ...baseQueueOptions.defaultJobOptions,
      attempts: 5, // Retry 5 times
      backoff: {
        type: 'fixed',
        delay: 5000, // 5s delay (linear)
      },
    },
  }),

  dlq: new Queue<DLQJob>('scrape-dlq', {
    ...baseQueueOptions,
    defaultJobOptions: {
      ...baseQueueOptions.defaultJobOptions,
      attempts: 1, // No retry for DLQ
      removeOnComplete: {
        count: 1000,
        age: 30 * 24 * 3600, // Keep for 30 days
      },
      removeOnFail: false, // Never remove failed DLQ jobs
    },
  }),
};

/**
 * Initialize all queues
 */
export const initQueues = async (): Promise<void> => {
  try {
    const redis = createRedisClient();
    await redis.ping();
    await redis.quit();

    logger.info('Queue system initialized', {
      module: 'queue',
      queues: Object.keys(queues),
    });
  } catch (error) {
    logger.error('Failed to initialize queue system', error as Error, { module: 'queue' });
    throw error;
  }
};

/**
 * Close all queues gracefully
 */
export const closeQueues = async (): Promise<void> => {
  logger.info('Closing all queues...', { module: 'queue' });

  try {
    await Promise.race([
      Promise.all([
        queues.pending.close(),
        queues.raw.close(),
        queues.processed.close(),
        queues.dlq.close(),
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Queue close timeout')), 5000)),
    ]);

    logger.info('All queues closed', { module: 'queue' });
  } catch (error) {
    logger.warn('Queue close timeout, forcing exit', { module: 'queue' });
  }
};

/**
 * Move failed job to DLQ
 */
export const moveToDLQ = async (job: Job, error: Error, queueName: string): Promise<void> => {
  const dlqJob: DLQJob = {
    originalJobId: job.id || 'unknown',
    source: job.data.source || 'unknown',
    failedQueue: queueName,
    error: error.message,
    stackTrace: error.stack,
    payload: job.data,
    failedAt: new Date().toISOString(),
    attempts: job.attemptsMade,
  };

  await queues.dlq.add(`dlq-${job.id}`, dlqJob);

  logger.warn('Job moved to DLQ', {
    module: 'queue',
    jobId: job.id,
    queueName,
    error: error.message,
  });
};

/**
 * Get queue metrics
 */
export const getQueueMetrics = async (): Promise<Record<string, unknown>> => {
  const metrics: Record<string, unknown> = {};

  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    metrics[name] = counts;
  }

  return metrics;
};
