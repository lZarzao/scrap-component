import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../../db/client';
import { queues } from '../../queue/queues';
import { triggerBooksScrape, triggerHNScrape } from '../../scheduler/jobFactory';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
  validateBody,
  validateQuery,
  validateUUID,
  parsePagination,
} from '../middleware/validation';
import { logger } from '../../logger';

const router = Router();

/**
 * POST /api/v1/jobs/trigger
 * Manually trigger a scrape job
 */
const TriggerJobSchema = z.object({
  source: z.enum(['books', 'hackernews']),
});

router.post(
  '/trigger',
  validateBody(TriggerJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { source } = req.body;

    logger.info('Manual job trigger requested', {
      module: 'api/jobs',
      source,
    });

    let jobId: string;

    if (source === 'books') {
      jobId = await triggerBooksScrape();
    } else {
      jobId = await triggerHNScrape();
    }

    res.status(202).json({
      message: 'Scrape job triggered successfully',
      jobId,
      source,
      status: 'pending',
    });
  })
);

/**
 * GET /api/v1/jobs
 * List all scrape jobs with filters
 */
const ListJobsSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  source: z.enum(['books', 'hackernews']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

router.get(
  '/',
  validateQuery(ListJobsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, source } = req.query;
    const { limit, offset } = parsePagination(req.query as any);

    const db = getDatabase();
    let baseQuery = db('scrape_jobs');

    if (status) {
      baseQuery = baseQuery.where('status', status);
    }

    if (source) {
      baseQuery = baseQuery.where('source', source);
    }

    // Get total count
    const [{ count }] = await baseQuery.clone().count('* as count');
    const total = parseInt(count as string, 10);

    // Get paginated results
    const jobs = await baseQuery
      .clone()
      .select('*')
      .orderBy('triggered_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      data: jobs,
      pagination: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

/**
 * GET /api/v1/jobs/dlq
 * Inspect dead-letter queue contents
 */
router.get(
  '/dlq',
  asyncHandler(async (_req: Request, res: Response) => {
    const dlqJobs = await queues.dlq.getJobs(['waiting', 'failed', 'completed'], 0, 50);

    const formattedJobs = dlqJobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
    }));

    res.json({
      total: formattedJobs.length,
      jobs: formattedJobs,
    });
  })
);

/**
 * DELETE /api/v1/jobs/dlq/:jobId
 * Remove a specific job from the DLQ
 */
router.delete(
  '/dlq/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    const job = await queues.dlq.getJob(jobId);

    if (!job) {
      throw new ApiError(404, 'DLQ job not found', { jobId });
    }

    await job.remove();

    logger.info('DLQ job removed', {
      module: 'api/jobs',
      jobId,
    });

    res.json({
      message: 'Job removed from DLQ successfully',
      jobId,
    });
  })
);

/**
 * POST /api/v1/jobs/dlq/:jobId/retry
 * Re-queue a DLQ job for reprocessing
 */
router.post(
  '/dlq/:jobId/retry',
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;

    const job = await queues.dlq.getJob(jobId);

    if (!job) {
      throw new ApiError(404, 'DLQ job not found', { jobId });
    }

    const jobData = job.data as any;
    const { originalJobId, source, payload } = jobData;

    // Determine which queue to retry to based on the failed queue
    const failedQueue = jobData.failedQueue || 'scrape:pending';

    let targetQueue: any;
    if (failedQueue.includes('pending')) {
      targetQueue = queues.pending;
    } else if (failedQueue.includes('raw')) {
      targetQueue = queues.raw;
    } else if (failedQueue.includes('processed')) {
      targetQueue = queues.processed;
    } else {
      throw new ApiError(400, 'Cannot determine target queue for retry');
    }

    // Re-add to appropriate queue
    await targetQueue.add(`retry-${originalJobId}`, payload || jobData.payload, {
      priority: source === 'hackernews' ? 1 : 2,
    });

    // Remove from DLQ
    await job.remove();

    logger.info('DLQ job retried', {
      module: 'api/jobs',
      jobId,
      originalJobId,
      targetQueue: failedQueue,
    });

    res.json({
      message: 'Job re-queued for retry successfully',
      jobId,
      originalJobId,
      targetQueue: failedQueue,
    });
  })
);

/**
 * GET /api/v1/jobs/:id
 * Get single job detail
 */
router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDatabase();

    const job = await db('scrape_jobs').where('id', id).first();

    if (!job) {
      throw new ApiError(404, 'Job not found', { jobId: id });
    }

    res.json(job);
  })
);

export default router;
