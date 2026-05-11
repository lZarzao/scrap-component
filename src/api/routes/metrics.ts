import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/client';
import { queues } from '../../queue/queues';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/v1/metrics
 * Queue metrics and system statistics
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDatabase();

    // Get queue depths
    const queueDepths = {
      pending: await queues.pending.count(),
      raw: await queues.raw.count(),
      processed: await queues.processed.count(),
      dlq: await queues.dlq.count(),
    };

    // Get jobs completed/failed in last 1 hour per source
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const jobStats = await db('scrape_jobs')
      .select('source', 'status')
      .count('* as count')
      .where('triggered_at', '>=', oneHourAgo)
      .groupBy('source', 'status');

    // Transform job stats into readable format
    const jobsLastHour = {
      books: {
        completed: 0,
        failed: 0,
        pending: 0,
        processing: 0,
      },
      hackernews: {
        completed: 0,
        failed: 0,
        pending: 0,
        processing: 0,
      },
    };

    jobStats.forEach((stat: any) => {
      const source = stat.source as 'books' | 'hackernews';
      const status = stat.status as 'completed' | 'failed' | 'pending' | 'processing';
      jobsLastHour[source][status] = parseInt(stat.count, 10);
    });

    // Calculate average processing latency for completed jobs
    const latencyStats = await db('scrape_jobs')
      .select('source')
      .select(db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - triggered_at))) as avg_duration'))
      .where('status', 'completed')
      .where('triggered_at', '>=', oneHourAgo)
      .groupBy('source');

    const avgLatency: Record<string, number> = {};
    latencyStats.forEach((stat: any) => {
      avgLatency[stat.source] = parseFloat(stat.avg_duration || '0');
    });

    // Get last successful run per source
    const lastSuccessful = await db('scrape_jobs')
      .select('source', 'completed_at')
      .whereNotNull('completed_at')
      .where('status', 'completed')
      .orderBy('completed_at', 'desc')
      .groupBy('source', 'completed_at')
      .limit(2);

    const lastSuccessfulRun: Record<string, string | null> = {
      books: null,
      hackernews: null,
    };

    lastSuccessful.forEach((job: any) => {
      lastSuccessfulRun[job.source] = job.completed_at;
    });

    // Get total records scraped per source
    const [booksCount] = await db('books').count('* as count');
    const [storiesCount] = await db('hn_stories').count('* as count');

    const totalRecords = {
      books: parseInt(booksCount.count as string, 10),
      hackernews: parseInt(storiesCount.count as string, 10),
    };

    // Process memory and CPU usage
    const processMetrics = {
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
      },
      cpu: process.cpuUsage(),
    };

    res.json({
      timestamp: new Date().toISOString(),
      queues: queueDepths,
      jobs: {
        lastHour: jobsLastHour,
        avgLatencySeconds: avgLatency,
        lastSuccessfulRun,
      },
      totalRecords,
      process: processMetrics,
    });
  })
);

export default router;
