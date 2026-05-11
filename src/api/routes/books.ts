import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../../db/client';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { validateQuery, parsePagination } from '../middleware/validation';

const router = Router();

/**
 * GET /api/v1/books
 * List scraped books with filters
 */
const ListBooksSchema = z.object({
  category: z.string().optional(),
  minRating: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.get(
  '/',
  validateQuery(ListBooksSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, minRating } = req.query;
    const { limit, offset } = parsePagination(req.query as any);

    const db = getDatabase();
    let baseQuery = db('books');

    if (category) {
      baseQuery = baseQuery.where('category', 'ilike', `%${category}%`);
    }

    if (minRating !== undefined) {
      baseQuery = baseQuery.where('rating', '>=', minRating as any);
    }

    // Get total count
    const [{ count }] = await baseQuery.clone().count('* as count');
    const total = parseInt(count as string, 10);

    // Get paginated results
    const books = await baseQuery
      .clone()
      .select('*')
      .orderBy('scraped_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      data: books,
      pagination: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        pages: Math.ceil(total / limit),
      },
      filters: {
        category: category || null,
        minRating: minRating || null,
      },
    });
  })
);

/**
 * GET /api/v1/books/:upc
 * Get a single book by UPC
 */
router.get(
  '/:upc',
  asyncHandler(async (req: Request, res: Response) => {
    const { upc } = req.params;
    const db = getDatabase();

    const book = await db('books').where('upc', upc).first();

    if (!book) {
      throw new ApiError(404, 'Book not found', { upc });
    }

    res.json(book);
  })
);

export default router;
