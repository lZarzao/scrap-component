import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../../db/client';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { validateQuery, parsePagination } from '../middleware/validation';

const router = Router();

/**
 * GET /api/v1/stories
 * List HN stories with filters
 */
const ListStoriesSchema = z.object({
  type: z.enum(['story', 'ask', 'show', 'job']).optional(),
  minScore: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.get(
  '/',
  validateQuery(ListStoriesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { type, minScore } = req.query;
    const { limit, offset } = parsePagination(req.query as any);

    const db = getDatabase();
    let baseQuery = db('hn_stories');

    if (type) {
      baseQuery = baseQuery.where('story_type', type);
    }

    if (minScore !== undefined) {
      baseQuery = baseQuery.where('score', '>=', minScore as any);
    }

    // Get total count
    const [{ count }] = await baseQuery.clone().count('* as count');
    const total = parseInt(count as string, 10);

    // Get paginated results
    const stories = await baseQuery
      .clone()
      .select('*')
      .orderBy('scraped_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      data: stories,
      pagination: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        pages: Math.ceil(total / limit),
      },
      filters: {
        type: type || null,
        minScore: minScore || null,
      },
    });
  })
);

/**
 * GET /api/v1/stories/:hn_item_id
 * Get single story by HN item ID
 */
router.get(
  '/:hn_item_id',
  asyncHandler(async (req: Request, res: Response) => {
    const hn_item_id = parseInt(req.params.hn_item_id as string, 10);

    if (isNaN(hn_item_id)) {
      throw new ApiError(400, 'Invalid HN item ID');
    }

    const db = getDatabase();
    const story = await db('hn_stories').where('hn_item_id', hn_item_id).first();

    if (!story) {
      throw new ApiError(404, 'Story not found', { hn_item_id });
    }

    res.json(story);
  })
);

export default router;
