import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/client';
import { createRedisClient } from '../../queue/queues';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../../logger';

const router = Router();

/**
 * GET /api/v1/health
 * Health check endpoint
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const checks = {
      database: false,
      redis: false,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };

    try {
      // Check database connection
      const db = getDatabase();
      await db.raw('SELECT 1');
      checks.database = true;
    } catch (error) {
      logger.error('Database health check failed', error as Error, {
        module: 'api/health',
      });
    }

    try {
      // Check Redis connection
      const redis = createRedisClient();
      await redis.ping();
      await redis.quit();
      checks.redis = true;
    } catch (error) {
      logger.error('Redis health check failed', error as Error, {
        module: 'api/health',
      });
    }

    const isHealthy = checks.database && checks.redis;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks,
    });
  })
);

export default router;
