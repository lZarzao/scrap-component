import { Job } from 'bullmq';
import { queues, DLQJob } from './queues';
import { logger } from '../logger';

/**
 * Get all jobs in the DLQ
 */
export async function getDLQJobs(): Promise<Job<DLQJob>[]> {
  try {
    const jobs = await queues.dlq.getJobs(['waiting', 'active', 'completed', 'failed']);

    logger.info('Retrieved DLQ jobs', {
      module: 'dlq',
      count: jobs.length,
    });

    return jobs;
  } catch (error) {
    logger.error('Failed to retrieve DLQ jobs', error as Error, {
      module: 'dlq',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get DLQ job by ID
 */
export async function getDLQJob(jobId: string): Promise<Job<DLQJob> | null> {
  try {
    const job = await queues.dlq.getJob(jobId);

    if (!job) {
      logger.warn('DLQ job not found', {
        module: 'dlq',
        jobId,
      });
      return null;
    }

    logger.debug('Retrieved DLQ job', {
      module: 'dlq',
      jobId,
    });

    return job;
  } catch (error) {
    logger.error('Failed to retrieve DLQ job', error as Error, {
      module: 'dlq',
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get DLQ jobs count
 */
export async function getDLQJobsCount(): Promise<number> {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      queues.dlq.getWaitingCount(),
      queues.dlq.getActiveCount(),
      queues.dlq.getCompletedCount(),
      queues.dlq.getFailedCount(),
    ]);

    const total = waiting + active + completed + failed;

    logger.info('Retrieved DLQ counts', {
      module: 'dlq',
      waiting,
      active,
      completed,
      failed,
      total,
    });

    return total;
  } catch (error) {
    logger.error('Failed to retrieve DLQ counts', error as Error, {
      module: 'dlq',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Retry a job from DLQ by re-queueing to its original queue
 */
export async function retryDLQJob(jobId: string): Promise<boolean> {
  try {
    const dlqJob = await queues.dlq.getJob(jobId);

    if (!dlqJob) {
      logger.warn('DLQ job not found for retry', {
        module: 'dlq',
        jobId,
      });
      return false;
    }

    const dlqData = dlqJob.data;
    const originalJobPayload = dlqData.payload as any;

    // Determine which queue to re-add to
    let targetQueue;
    let jobName;

    if (dlqData.failedQueue === 'scrape:pending') {
      targetQueue = queues.pending;
      jobName = `scrape-${dlqData.source}-${Date.now()}`;
    } else if (dlqData.failedQueue === 'scrape:raw') {
      targetQueue = queues.raw;
      jobName = `transform-${dlqData.source}-${Date.now()}`;
    } else if (dlqData.failedQueue === 'scrape:processed') {
      targetQueue = queues.processed;
      jobName = `persist-${dlqData.source}-${Date.now()}`;
    } else {
      throw new Error(`Unknown queue: ${dlqData.failedQueue}`);
    }

    // Re-add job to original queue with incremented attempt
    const retriedJob = await targetQueue.add(jobName, originalJobPayload, {
      priority: dlqData.source === 'hn' || dlqData.source === 'hackernews' ? 1 : 2,
    });

    // Remove from DLQ
    await dlqJob.remove();

    logger.info('DLQ job retried successfully', {
      module: 'dlq',
      jobId,
      originalQueue: dlqData.failedQueue,
      newJobId: retriedJob.id,
    });

    return true;
  } catch (error) {
    logger.error('Failed to retry DLQ job', error as Error, {
      module: 'dlq',
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Remove a job from DLQ permanently
 */
export async function removeDLQJob(jobId: string): Promise<boolean> {
  try {
    const job = await queues.dlq.getJob(jobId);

    if (!job) {
      logger.warn('DLQ job not found for removal', {
        module: 'dlq',
        jobId,
      });
      return false;
    }

    await job.remove();

    logger.info('DLQ job removed successfully', {
      module: 'dlq',
      jobId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to remove DLQ job', error as Error, {
      module: 'dlq',
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clear all jobs from DLQ
 */
export async function clearDLQ(): Promise<number> {
  try {
    await queues.dlq.obliterate({ force: true });

    logger.info('DLQ cleared successfully', {
      module: 'dlq',
    });

    return 0;
  } catch (error) {
    logger.error('Failed to clear DLQ', error as Error, {
      module: 'dlq',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get DLQ statistics
 */
export async function getDLQStats(): Promise<{
  total: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  bySource: Record<string, number>;
  byQueue: Record<string, number>;
}> {
  try {
    const [waiting, active, completed, failed, jobs] = await Promise.all([
      queues.dlq.getWaitingCount(),
      queues.dlq.getActiveCount(),
      queues.dlq.getCompletedCount(),
      queues.dlq.getFailedCount(),
      getDLQJobs(),
    ]);

    const total = waiting + active + completed + failed;

    // Group by source and queue
    const bySource: Record<string, number> = {};
    const byQueue: Record<string, number> = {};

    for (const job of jobs) {
      const source = job.data.source;
      const queue = job.data.failedQueue;

      bySource[source] = (bySource[source] || 0) + 1;
      byQueue[queue] = (byQueue[queue] || 0) + 1;
    }

    const stats = {
      total,
      waiting,
      active,
      completed,
      failed,
      bySource,
      byQueue,
    };

    logger.info('Retrieved DLQ statistics', {
      module: 'dlq',
      stats,
    });

    return stats;
  } catch (error) {
    logger.error('Failed to retrieve DLQ statistics', error as Error, {
      module: 'dlq',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
