import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../../config';
import { logger } from '../../logger';
import { rateLimiter } from '../rateLimiter';

/**
 * Raw Hacker News story data structure (before validation)
 */
export interface RawHNData {
  item_id: string;
  title: string;
  url: string | null;
  score: string;
  author: string;
  age_text: string;
  comment_count: string;
  story_type: 'story' | 'ask' | 'show' | 'job';
}

const BASE_URL = 'https://news.ycombinator.com';
const HOST = 'news.ycombinator.com';

/**
 * Detect story type based on title
 */
const detectStoryType = (title: string): 'story' | 'ask' | 'show' | 'job' => {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.startsWith('ask hn:')) {
    return 'ask';
  }
  if (lowerTitle.startsWith('show hn:')) {
    return 'show';
  }
  if (lowerTitle.includes('hiring') || lowerTitle.includes('who is hiring')) {
    return 'job';
  }

  return 'story';
};

/**
 * Extract item ID from various possible sources in the HTML
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractItemId = ($row: cheerio.Cheerio<any>): string | null => {
  // Try to extract from vote link
  const voteId = $row.find('a[id^="up_"]').attr('id');
  if (voteId) {
    return voteId.replace('up_', '');
  }

  // Try to extract from comments link
  const commentsHref = $row.find('a:contains("comment")').attr('href');
  if (commentsHref) {
    const match = commentsHref.match(/id=(\d+)/);
    if (match) {
      return match[1];
    }
  }

  // Try to extract from hide link
  const hideHref = $row.find('a:contains("hide")').attr('href');
  if (hideHref) {
    const match = hideHref.match(/id=(\d+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
};

/**
 * Scrape a single Hacker News page
 */
const scrapeHNPage = async (pageNum: number): Promise<RawHNData[]> => {
  const url = pageNum === 1 ? `${BASE_URL}/newest` : `${BASE_URL}/newest?p=${pageNum}`;

  await rateLimiter.wait(HOST);

  try {
    logger.debug('Scraping HN page', {
      module: 'hnScraper',
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
    const stories: RawHNData[] = [];

    // HN uses a table with class "itemlist"
    $('tr.athing').each((_, element) => {
      const $row = $(element);
      const $subtext = $row.next('tr').find('td.subtext');

      // Extract item ID
      const item_id = extractItemId($row);
      if (!item_id) {
        logger.debug('Could not extract item_id, skipping', { module: 'hnScraper' });
        return; // Skip this item
      }

      // Extract title
      const $titleLink = $row.find('span.titleline > a').first();
      const title = $titleLink.text().trim() || '';

      // Extract URL (null for self-posts/Ask HN)
      let url = $titleLink.attr('href') || null;
      // If URL is relative (starts with item?id=), it's a self-post
      if (url && url.startsWith('item?id=')) {
        url = null; // Self-post
      }

      // Extract score
      const scoreText = $subtext.find('span.score').text().trim();
      const score = scoreText.replace(' points', '').replace(' point', '') || '0';

      // Extract author
      const author = $subtext.find('a.hnuser').text().trim() || 'unknown';

      // Extract age text
      const ageText = $subtext.find('span.age').text().trim() || 'unknown';

      // Extract comment count
      const commentsText = $subtext.find('a:contains("comment")').text().trim();
      let comment_count = '0';
      if (commentsText) {
        const match = commentsText.match(/(\d+)/);
        if (match) {
          comment_count = match[1];
        }
      }

      // Detect story type
      const story_type = detectStoryType(title);

      if (title && item_id) {
        stories.push({
          item_id,
          title,
          url,
          score,
          author,
          age_text: ageText,
          comment_count,
          story_type,
        });
      }
    });

    logger.info('Scraped HN page', {
      module: 'hnScraper',
      pageNum,
      storiesFound: stories.length,
    });

    return stories;
  } catch (error) {
    logger.error('Failed to scrape HN page', error as Error, {
      module: 'hnScraper',
      pageNum,
      url,
    });
    return [];
  }
};

/**
 * Main scraper function: scrape Hacker News stories from multiple pages
 */
export const scrapeHN = async (maxPages: number = 2): Promise<RawHNData[]> => {
  logger.info('Starting HN scrape', {
    module: 'hnScraper',
    maxPages,
  });

  const allStories: RawHNData[] = [];

  try {
    // Scrape all pages
    for (let page = 1; page <= maxPages; page++) {
      const stories = await scrapeHNPage(page);
      allStories.push(...stories);
    }

    logger.info('HN scrape completed', {
      module: 'hnScraper',
      totalStories: allStories.length,
      storyTypes: {
        story: allStories.filter((s) => s.story_type === 'story').length,
        ask: allStories.filter((s) => s.story_type === 'ask').length,
        show: allStories.filter((s) => s.story_type === 'show').length,
        job: allStories.filter((s) => s.story_type === 'job').length,
      },
    });

    return allStories;
  } catch (error) {
    logger.error('HN scrape failed', error as Error, {
      module: 'hnScraper',
    });
    throw error;
  }
};
