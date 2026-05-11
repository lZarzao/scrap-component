import { Router, Request, Response } from 'express';
import { getMetrics, getContentType } from '../../metrics/prometheus';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 *
 * Returns metrics in Prometheus text format that can be scraped
 * by a Prometheus server
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const metrics = await getMetrics();
    res.set('Content-Type', getContentType());
    res.send(metrics);
  })
);

export default router;
