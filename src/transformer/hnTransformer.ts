import { RawHNStorySchema, CleanHNStorySchema, CleanHNStory, StoryType } from '../types/schemas';
import { logger } from '../logger';

/**
 * Detect story type from title
 * Priority order: Ask HN > Show HN > other keywords > default to 'story'
 */
function detectStoryType(title: string): StoryType {
  const lower = title.toLowerCase();

  // Check for Ask HN
  if (lower.includes('ask hn') || lower.startsWith('ask hn:')) {
    return 'ask';
  }

  // Check for Show HN
  if (lower.includes('show hn') || lower.startsWith('show hn:')) {
    return 'show';
  }

  // Check for Job postings
  if (
    lower.includes('[hiring]') ||
    lower.includes('(hiring)') ||
    lower.includes('hiring:') ||
    lower.includes('who is hiring')
  ) {
    return 'job';
  }

  // Default to story
  return 'story';
}

/**
 * Transform raw HN story data to clean, validated story data
 * Throws ZodError if validation fails
 */
export function transformHNStory(raw: unknown): CleanHNStory {
  // First validate raw input structure
  const validated = RawHNStorySchema.parse(raw);

  try {
    // Transform fields
    const transformed = {
      hn_item_id: validated.item_id,
      title: validated.title.trim(),
      url: validated.url?.trim() || null,
      score: validated.score,
      author: validated.author.trim(),
      age_text: validated.age_text.trim(),
      comment_count: validated.comment_count,
      story_type: detectStoryType(validated.title),
    };

    // Validate clean data structure
    const cleanStory = CleanHNStorySchema.parse(transformed);

    logger.debug('Successfully transformed HN story', {
      module: 'hnTransformer',
      hn_item_id: cleanStory.hn_item_id,
      story_type: cleanStory.story_type,
    });

    return cleanStory;
  } catch (error) {
    logger.error('Failed to transform HN story', error as Error, {
      module: 'hnTransformer',
      error: error instanceof Error ? error.message : String(error),
      raw,
    });
    throw error;
  }
}

/**
 * Transform array of raw HN stories
 * Returns only successfully transformed stories
 * Logs errors for failed transformations but continues processing
 */
export function transformHNStories(rawStories: unknown[]): CleanHNStory[] {
  const cleanStories: CleanHNStory[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < rawStories.length; i++) {
    try {
      const cleanStory = transformHNStory(rawStories[i]);
      cleanStories.push(cleanStory);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ index: i, error: errorMsg });

      logger.warn('Skipped invalid HN story during batch transformation', {
        module: 'hnTransformer',
        index: i,
        error: errorMsg,
      });
    }
  }

  logger.info('Batch HN story transformation completed', {
    module: 'hnTransformer',
    total: rawStories.length,
    successful: cleanStories.length,
    failed: errors.length,
  });

  // If all stories failed validation, throw error
  if (cleanStories.length === 0 && rawStories.length > 0) {
    throw new Error(
      `All ${rawStories.length} stories failed transformation. First error: ${errors[0]?.error}`
    );
  }

  return cleanStories;
}
