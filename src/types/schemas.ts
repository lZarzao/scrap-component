import { z } from 'zod';

/**
 * Story types for Hacker News
 */
export const StoryTypeEnum = z.enum(['story', 'ask', 'show', 'job']);
export type StoryType = z.infer<typeof StoryTypeEnum>;

/**
 * Raw book data from scraper (before transformation)
 */
export const RawBookSchema = z.object({
  title: z.string().min(1).max(500),
  price: z.string(), // e.g., "£45.50"
  rating: z.union([z.string(), z.number()]), // e.g., "Three" or 3
  availability: z.string(), // e.g., "In stock (22 available)"
  category: z.string().min(1).max(100),
  upc: z.string().min(1).max(50),
  description: z.string().nullable().optional(),
  num_reviews: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) || 0 : val))
    .pipe(z.number().int().nonnegative())
    .default(0),
});

export type RawBook = z.infer<typeof RawBookSchema>;

/**
 * Clean book data (after transformation, ready for DB)
 */
export const CleanBookSchema = z.object({
  upc: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  price_gbp: z.number().positive().finite(),
  rating: z.number().int().min(1).max(5),
  category: z.string().min(1).max(100),
  available: z.boolean(),
  description: z.string().nullable().optional(),
  num_reviews: z.number().int().nonnegative().default(0),
});

export type CleanBook = z.infer<typeof CleanBookSchema>;

/**
 * Raw HN story data from scraper (before transformation)
 */
export const RawHNStorySchema = z.object({
  item_id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  url: z.string().url().max(1000).nullable().optional(),
  score: z.number().int().nonnegative().default(0),
  author: z.string().min(1).max(100),
  age_text: z.string().max(50),
  comment_count: z.number().int().nonnegative().default(0),
});

export type RawHNStory = z.infer<typeof RawHNStorySchema>;

/**
 * Clean HN story data (after transformation, ready for DB)
 */
export const CleanHNStorySchema = z.object({
  hn_item_id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  url: z.string().url().max(1000).nullable().optional(),
  score: z.number().int().nonnegative().default(0),
  author: z.string().min(1).max(100),
  age_text: z.string().max(50),
  comment_count: z.number().int().nonnegative().default(0),
  story_type: StoryTypeEnum,
});

export type CleanHNStory = z.infer<typeof CleanHNStorySchema>;

/**
 * Job descriptor for queues
 */
export const JobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  source: z.enum(['books', 'hackernews']),
  createdAt: z.string().datetime(),
  attempt: z.number().int().positive().default(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type JobPayload = z.infer<typeof JobPayloadSchema>;

/**
 * Raw data job for scrape:raw queue
 */
export const RawDataJobSchema = z.object({
  jobId: z.string().uuid(),
  source: z.enum(['books', 'hackernews']),
  rawData: z.array(z.unknown()),
  scrapedAt: z.string().datetime().optional(), // Optional for backward compatibility with Phase 2 scraper
});

export type RawDataJob = z.infer<typeof RawDataJobSchema>;

/**
 * Processed data job for scrape:processed queue
 */
export const ProcessedDataJobSchema = z.object({
  jobId: z.string().uuid(),
  source: z.enum(['books', 'hackernews']),
  cleanData: z.array(z.union([CleanBookSchema, CleanHNStorySchema])),
  transformedAt: z.string().datetime(),
});

export type ProcessedDataJob = z.infer<typeof ProcessedDataJobSchema>;

/**
 * DLQ error job
 */
export const DLQJobSchema = z.object({
  originalJobId: z.string().uuid(),
  source: z.enum(['books', 'hackernews']),
  queue: z.string(),
  error: z.string(),
  stackTrace: z.string().optional(),
  jobPayload: z.unknown(),
  failedAt: z.string().datetime(),
  attempts: z.number().int().positive(),
});

export type DLQJob = z.infer<typeof DLQJobSchema>;
