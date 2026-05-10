import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../../config';
import { logger } from '../../logger';
import { rateLimiter } from '../rateLimiter';

/**
 * Raw book data structure (before validation)
 */
export interface RawBookData {
  title: string;
  price: string;
  rating: string;
  availability: string;
  category: string;
  product_url: string;
  upc?: string;
  description?: string;
  num_reviews?: string;
}

const BASE_URL = 'https://books.toscrape.com';
const HOST = 'books.toscrape.com';

/**
 * Convert star rating class to number
 */
const parseRating = (ratingClass: string): number => {
  const ratingMap: Record<string, number> = {
    One: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5,
  };

  for (const [word, num] of Object.entries(ratingMap)) {
    if (ratingClass.includes(word)) {
      return num;
    }
  }

  return 0; // Unknown rating
};

/**
 * Scrape a single book detail page
 */
const scrapeBookDetail = async (url: string): Promise<Partial<RawBookData>> => {
  await rateLimiter.wait(HOST);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': config.USER_AGENT,
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Extract UPC
    const upc = $('th:contains("UPC")').next('td').text().trim() || undefined;

    // Extract description
    const description = $('#product_description').next('p').text().trim() || undefined;

    // Extract number of reviews
    const numReviewsText = $('th:contains("Number of reviews")').next('td').text().trim();
    const num_reviews = numReviewsText || '0';

    logger.debug('Scraped book detail', {
      module: 'booksScraper',
      url,
      upc,
      hasDescription: !!description,
    });

    return {
      upc,
      description,
      num_reviews,
    };
  } catch (error) {
    logger.error('Failed to scrape book detail', error as Error, {
      module: 'booksScraper',
      url,
    });
    // Return empty object if detail page fails (graceful handling)
    return {};
  }
};

/**
 * Scrape a single catalogue page
 */
const scrapeCataloguePage = async (pageNum: number): Promise<RawBookData[]> => {
  const url =
    pageNum === 1
      ? `${BASE_URL}/catalogue/page-1.html`
      : `${BASE_URL}/catalogue/page-${pageNum}.html`;

  await rateLimiter.wait(HOST);

  try {
    logger.debug('Scraping catalogue page', {
      module: 'booksScraper',
      pageNum,
      url,
    });

    const response = await axios.get(url, {
      headers: {
        'User-Agent': config.USER_AGENT,
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const books: RawBookData[] = [];

    // Extract books from the page
    $('article.product_pod').each((_, element) => {
      const $book = $(element);

      // Extract basic info from catalogue page
      const title = $book.find('h3 a').attr('title') || '';
      const price = $book.find('p.price_color').text().trim() || '0';
      const ratingClass = $book.find('p.star-rating').attr('class') || '';
      const rating = parseRating(ratingClass).toString();
      const availability = $book.find('p.availability').text().trim() || 'Unknown';

      // Extract category (breadcrumb)
      const category = $('ul.breadcrumb li').eq(2).find('a').text().trim() || 'Unknown';

      // Extract product URL (relative path)
      const relativeUrl = $book.find('h3 a').attr('href') || '';
      const product_url = relativeUrl.startsWith('http')
        ? relativeUrl
        : `${BASE_URL}/catalogue/${relativeUrl.replace('../', '')}`;

      if (title && product_url) {
        books.push({
          title,
          price,
          rating,
          availability,
          category,
          product_url,
        });
      }
    });

    logger.info('Scraped catalogue page', {
      module: 'booksScraper',
      pageNum,
      booksFound: books.length,
    });

    return books;
  } catch (error) {
    logger.error('Failed to scrape catalogue page', error as Error, {
      module: 'booksScraper',
      pageNum,
      url,
    });
    return [];
  }
};

/**
 * Main scraper function: scrape books from multiple catalogue pages
 * and fetch detail information for each book
 */
export const scrapeBooks = async (maxPages: number = 5): Promise<RawBookData[]> => {
  logger.info('Starting books scrape', {
    module: 'booksScraper',
    maxPages,
  });

  const allBooks: RawBookData[] = [];

  try {
    // Step 1: Scrape catalogue pages
    for (let page = 1; page <= maxPages; page++) {
      const books = await scrapeCataloguePage(page);
      allBooks.push(...books);
    }

    logger.info('Catalogue pages scraped', {
      module: 'booksScraper',
      totalBooks: allBooks.length,
      pages: maxPages,
    });

    // Step 2: Fetch detail page for each book
    for (const book of allBooks) {
      const details = await scrapeBookDetail(book.product_url);
      Object.assign(book, details);
    }

    logger.info('Books scrape completed', {
      module: 'booksScraper',
      totalBooks: allBooks.length,
      booksWithUPC: allBooks.filter((b) => b.upc).length,
    });

    return allBooks;
  } catch (error) {
    logger.error('Books scrape failed', error as Error, {
      module: 'booksScraper',
    });
    throw error;
  }
};
