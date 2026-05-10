import { RawBookSchema, CleanBookSchema, CleanBook } from '../types/schemas';
import { logger } from '../logger';

/**
 * Rating mapping from text to number
 */
const RATING_MAP: Record<string, number> = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
};

/**
 * Parse price from string to float
 * Examples: "£45.50" -> 45.50, "£12.99" -> 12.99
 */
function parsePrice(priceStr: string): number {
  // Remove currency symbol and whitespace
  const cleaned = priceStr.replace(/[£$€\s]/g, '');
  const price = parseFloat(cleaned);

  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid price: ${priceStr}`);
  }

  return price;
}

/**
 * Parse rating from text or number to integer
 * Examples: "Three" -> 3, "Five" -> 5, 3 -> 3, "3" -> 3
 */
function parseRating(ratingInput: string | number): number {
  // If already a number, validate and return
  if (typeof ratingInput === 'number') {
    if (ratingInput >= 1 && ratingInput <= 5) {
      return ratingInput;
    }
    throw new Error(`Invalid rating number: ${ratingInput}. Expected 1-5`);
  }

  // If string, try to parse as number first
  const asNumber = parseInt(ratingInput, 10);
  if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= 5) {
    return asNumber;
  }

  // Try text mapping
  const rating = RATING_MAP[ratingInput];

  if (!rating) {
    throw new Error(
      `Invalid rating: ${ratingInput}. Expected one of: ${Object.keys(RATING_MAP).join(', ')}, or a number 1-5`
    );
  }

  return rating;
}

/**
 * Parse availability to boolean
 * Examples: "In stock (22 available)" -> true, "Out of stock" -> false
 */
function parseAvailability(availStr: string): boolean {
  const lower = availStr.toLowerCase();
  return lower.includes('in stock');
}

/**
 * Transform raw book data to clean, validated book data
 * Throws ZodError if validation fails
 */
export function transformBook(raw: unknown): CleanBook {
  // First validate raw input structure
  const validated = RawBookSchema.parse(raw);

  try {
    // Transform fields
    const transformed = {
      upc: validated.upc,
      title: validated.title.trim(),
      price_gbp: parsePrice(validated.price),
      rating: parseRating(validated.rating),
      category: validated.category.trim(),
      available: parseAvailability(validated.availability),
      description: validated.description?.trim() || null,
      num_reviews: validated.num_reviews,
    };

    // Validate clean data structure
    const cleanBook = CleanBookSchema.parse(transformed);

    logger.debug('Successfully transformed book', {
      module: 'bookTransformer',
      upc: cleanBook.upc,
    });

    return cleanBook;
  } catch (error) {
    logger.error('Failed to transform book', error as Error, {
      module: 'bookTransformer',
      error: error instanceof Error ? error.message : String(error),
      raw,
    });
    throw error;
  }
}

/**
 * Transform array of raw books
 * Returns only successfully transformed books
 * Logs errors for failed transformations but continues processing
 */
export function transformBooks(rawBooks: unknown[]): CleanBook[] {
  const cleanBooks: CleanBook[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < rawBooks.length; i++) {
    try {
      const cleanBook = transformBook(rawBooks[i]);
      cleanBooks.push(cleanBook);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ index: i, error: errorMsg });

      logger.warn('Skipped invalid book during batch transformation', {
        module: 'bookTransformer',
        index: i,
        error: errorMsg,
      });
    }
  }

  logger.info('Batch book transformation completed', {
    module: 'bookTransformer',
    total: rawBooks.length,
    successful: cleanBooks.length,
    failed: errors.length,
  });

  // If all books failed validation, throw error
  if (cleanBooks.length === 0 && rawBooks.length > 0) {
    throw new Error(
      `All ${rawBooks.length} books failed transformation. First error: ${errors[0]?.error}`
    );
  }

  return cleanBooks;
}
