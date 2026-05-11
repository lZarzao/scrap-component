import { getDatabase } from '../db/client';
import { CleanBook, CleanHNStory } from '../types/schemas';
import { logger } from '../logger';

/**
 * Upsert books into the database
 * Uses ON CONFLICT to handle duplicates based on UPC
 * Returns number of rows affected
 */
export async function upsertBooks(books: CleanBook[]): Promise<number> {
  if (books.length === 0) {
    logger.debug('No books to upsert', {
      module: 'upsert',
      table: 'books',
    });
    return 0;
  }

  const db = getDatabase();

  try {
    // Deduplicate books by upc (keep last occurrence)
    const deduped = new Map<string, CleanBook>();
    for (const book of books) {
      deduped.set(book.upc, book);
    }
    const uniqueBooks = Array.from(deduped.values());

    if (uniqueBooks.length < books.length) {
      logger.warn('Removed duplicate books before upsert', {
        module: 'upsert',
        table: 'books',
        originalCount: books.length,
        uniqueCount: uniqueBooks.length,
        duplicates: books.length - uniqueBooks.length,
      });
    }

    logger.info('Upserting books', {
      module: 'upsert',
      table: 'books',
      count: uniqueBooks.length,
    });

    // Prepare data for insert
    const booksData = uniqueBooks.map((book) => ({
      upc: book.upc,
      title: book.title,
      price_gbp: book.price_gbp,
      rating: book.rating,
      category: book.category,
      available: book.available,
      description: book.description,
      num_reviews: book.num_reviews,
      scraped_at: db.fn.now(),
    }));

    // Use Knex's onConflict for UPSERT
    // ON CONFLICT (upc) DO UPDATE
    await db('books')
      .insert(booksData)
      .onConflict('upc')
      .merge({
        title: db.raw('EXCLUDED.title'),
        price_gbp: db.raw('EXCLUDED.price_gbp'),
        rating: db.raw('EXCLUDED.rating'),
        category: db.raw('EXCLUDED.category'),
        available: db.raw('EXCLUDED.available'),
        description: db.raw('EXCLUDED.description'),
        num_reviews: db.raw('EXCLUDED.num_reviews'),
        scraped_at: db.raw('EXCLUDED.scraped_at'),
        // updated_at is handled by trigger
      });

    logger.info('Books upserted successfully', {
      module: 'upsert',
      table: 'books',
      count: uniqueBooks.length,
    });

    return uniqueBooks.length;
  } catch (error) {
    logger.error('Failed to upsert books', error as Error, {
      module: 'upsert',
      table: 'books',
      count: books.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Upsert HN stories into the database
 * Uses ON CONFLICT to handle duplicates based on hn_item_id
 * Returns number of rows affected
 */
export async function upsertHNStories(stories: CleanHNStory[]): Promise<number> {
  if (stories.length === 0) {
    logger.debug('No stories to upsert', {
      module: 'upsert',
      table: 'hn_stories',
    });
    return 0;
  }

  const db = getDatabase();

  try {
    // Deduplicate stories by hn_item_id (keep last occurrence)
    const deduped = new Map<number, CleanHNStory>();
    for (const story of stories) {
      deduped.set(story.hn_item_id, story);
    }
    const uniqueStories = Array.from(deduped.values());

    if (uniqueStories.length < stories.length) {
      logger.warn('Removed duplicate HN stories before upsert', {
        module: 'upsert',
        table: 'hn_stories',
        originalCount: stories.length,
        uniqueCount: uniqueStories.length,
        duplicates: stories.length - uniqueStories.length,
      });
    }

    logger.info('Upserting HN stories', {
      module: 'upsert',
      table: 'hn_stories',
      count: uniqueStories.length,
    });

    // Prepare data for insert
    const storiesData = uniqueStories.map((story) => ({
      hn_item_id: story.hn_item_id,
      title: story.title,
      url: story.url,
      score: story.score,
      author: story.author,
      age_text: story.age_text,
      comment_count: story.comment_count,
      story_type: story.story_type,
      scraped_at: db.fn.now(),
    }));

    // Use Knex's onConflict for UPSERT
    // ON CONFLICT (hn_item_id) DO UPDATE
    await db('hn_stories')
      .insert(storiesData)
      .onConflict('hn_item_id')
      .merge({
        title: db.raw('EXCLUDED.title'),
        url: db.raw('EXCLUDED.url'),
        score: db.raw('EXCLUDED.score'),
        author: db.raw('EXCLUDED.author'),
        age_text: db.raw('EXCLUDED.age_text'),
        comment_count: db.raw('EXCLUDED.comment_count'),
        story_type: db.raw('EXCLUDED.story_type'),
        scraped_at: db.raw('EXCLUDED.scraped_at'),
        // updated_at is handled by trigger
      });

    logger.info('HN stories upserted successfully', {
      module: 'upsert',
      table: 'hn_stories',
      count: uniqueStories.length,
    });

    return uniqueStories.length;
  } catch (error) {
    logger.error('Failed to upsert HN stories', error as Error, {
      module: 'upsert',
      table: 'hn_stories',
      count: stories.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get book by UPC
 */
export async function getBookByUPC(upc: string): Promise<CleanBook | null> {
  const db = getDatabase();
  const book = await db('books').where({ upc }).first();
  return book || null;
}

/**
 * Get HN story by item ID
 */
export async function getHNStoryById(hnItemId: number): Promise<CleanHNStory | null> {
  const db = getDatabase();
  const story = await db('hn_stories').where({ hn_item_id: hnItemId }).first();
  return story || null;
}

/**
 * Get books count
 */
export async function getBooksCount(): Promise<number> {
  const db = getDatabase();
  const result = await db('books').count('* as count').first();
  return parseInt(result?.count as string, 10) || 0;
}

/**
 * Get HN stories count
 */
export async function getHNStoriesCount(): Promise<number> {
  const db = getDatabase();
  const result = await db('hn_stories').count('* as count').first();
  return parseInt(result?.count as string, 10) || 0;
}
