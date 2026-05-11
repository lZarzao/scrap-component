import client from 'prom-client';
import { queues } from '../queue/queues';
import { getDatabase } from '../db/client';
import { logger } from '../logger';

/**
 * Prometheus metrics registry
 */
export const register = new client.Registry();

/**
 * Default metrics (process, nodejs)
 */
client.collectDefaultMetrics({
  register,
  prefix: 'dataharvest_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

/**
 * Custom metrics
 */

// Queue metrics
export const queueDepthGauge = new client.Gauge({
  name: 'dataharvest_queue_depth',
  help: 'Number of jobs in queue by state',
  labelNames: ['queue', 'state'],
  registers: [register],
});

export const jobsProcessedCounter = new client.Counter({
  name: 'dataharvest_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const jobProcessingDuration = new client.Histogram({
  name: 'dataharvest_job_processing_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

// Scraping metrics
export const scrapeRequestsCounter = new client.Counter({
  name: 'dataharvest_scrape_requests_total',
  help: 'Total number of scrape requests',
  labelNames: ['source', 'status'],
  registers: [register],
});

export const scrapeRequestDuration = new client.Histogram({
  name: 'dataharvest_scrape_request_duration_seconds',
  help: 'Scrape request duration in seconds',
  labelNames: ['source'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const scrapedRecordsCounter = new client.Counter({
  name: 'dataharvest_scraped_records_total',
  help: 'Total number of records scraped',
  labelNames: ['source', 'type'],
  registers: [register],
});

// Database metrics
export const databaseRecordsGauge = new client.Gauge({
  name: 'dataharvest_database_records_total',
  help: 'Total number of records in database',
  labelNames: ['table'],
  registers: [register],
});

export const databaseOperationsCounter = new client.Counter({
  name: 'dataharvest_database_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

// Rate limiter metrics
export const rateLimiterDelaysCounter = new client.Counter({
  name: 'dataharvest_rate_limiter_delays_total',
  help: 'Total number of rate limiter delays',
  labelNames: ['host'],
  registers: [register],
});

export const rateLimiterDelayDuration = new client.Histogram({
  name: 'dataharvest_rate_limiter_delay_duration_seconds',
  help: 'Rate limiter delay duration in seconds',
  labelNames: ['host'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// System health metrics
export const healthCheckGauge = new client.Gauge({
  name: 'dataharvest_health_check',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component'],
  registers: [register],
});

/**
 * Update queue depth metrics
 */
export const updateQueueMetrics = async (): Promise<void> => {
  try {
    const queueNames = ['pending', 'raw', 'processed', 'dlq'] as const;
    const states = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;

    for (const queueName of queueNames) {
      const queue = queues[queueName];

      for (const state of states) {
        try {
          const count = await queue.getJobCounts(state);
          queueDepthGauge.set({ queue: `scrape-${queueName}`, state }, count[state] || 0);
        } catch (error) {
          logger.error(`Failed to get ${state} count for queue ${queueName}`, error as Error, {
            module: 'prometheusMetrics',
          });
        }
      }
    }
  } catch (error) {
    logger.error('Failed to update queue metrics', error as Error, {
      module: 'prometheusMetrics',
    });
  }
};

/**
 * Update database record counts
 */
export const updateDatabaseMetrics = async (): Promise<void> => {
  try {
    const db = getDatabase();

    // Count books
    const [{ count: booksCount }] = await db('books').count('* as count');
    databaseRecordsGauge.set({ table: 'books' }, parseInt(booksCount as string, 10));

    // Count stories
    const [{ count: storiesCount }] = await db('hn_stories').count('* as count');
    databaseRecordsGauge.set({ table: 'hn_stories' }, parseInt(storiesCount as string, 10));

    // Count jobs
    const [{ count: jobsCount }] = await db('scrape_jobs').count('* as count');
    databaseRecordsGauge.set({ table: 'scrape_jobs' }, parseInt(jobsCount as string, 10));
  } catch (error) {
    logger.error('Failed to update database metrics', error as Error, {
      module: 'prometheusMetrics',
    });
  }
};

/**
 * Update health check metrics
 */
export const updateHealthMetrics = async (): Promise<void> => {
  try {
    const db = getDatabase();

    // Check database
    try {
      await db.raw('SELECT 1');
      healthCheckGauge.set({ component: 'database' }, 1);
    } catch {
      healthCheckGauge.set({ component: 'database' }, 0);
    }

    // Check Redis (via queue)
    try {
      const redisClient = await queues.pending.client;
      await redisClient.ping();
      healthCheckGauge.set({ component: 'redis' }, 1);
    } catch {
      healthCheckGauge.set({ component: 'redis' }, 0);
    }
  } catch (error) {
    logger.error('Failed to update health metrics', error as Error, {
      module: 'prometheusMetrics',
    });
  }
};

/**
 * Update all metrics
 */
export const updateAllMetrics = async (): Promise<void> => {
  await Promise.all([updateQueueMetrics(), updateDatabaseMetrics(), updateHealthMetrics()]);
};

/**
 * Get metrics in Prometheus text format
 */
export const getMetrics = async (): Promise<string> => {
  // Update metrics before returning
  await updateAllMetrics();
  return register.metrics();
};

/**
 * Get content type for Prometheus metrics
 */
export const getContentType = (): string => {
  return register.contentType;
};
