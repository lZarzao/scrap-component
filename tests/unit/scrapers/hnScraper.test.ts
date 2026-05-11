import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Mock dependencies before importing the module
vi.mock('axios');
vi.mock('../../src/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/config', () => ({
  config: {
    USER_AGENT: 'test-agent',
  },
}));

// Import after mocking
import { scrapeHN } from '../../../src/workers/scrapers/hnScraper';
import type { RawHNData } from '../../../src/workers/scrapers/hnScraper';

describe('hnScraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Story Type Detection', () => {
    test('should detect "ask" type from title', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '123',
          title: 'Ask HN: How do I test scrapers?',
          url: null,
          score: '10',
          author: 'testuser',
          age: '2 hours ago',
          comments: '5',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].story_type).toBe('ask');
      expect(result[0].title).toContain('Ask HN:');
    });

    test('should detect "show" type from title', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '456',
          title: 'Show HN: My awesome project',
          url: 'https://example.com',
          score: '50',
          author: 'creator',
          age: '1 hour ago',
          comments: '10',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].story_type).toBe('show');
      expect(result[0].title).toContain('Show HN:');
    });

    test('should detect "job" type from title', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '789',
          title: 'Company X is Hiring Engineers',
          url: 'https://jobs.example.com',
          score: '5',
          author: 'recruiter',
          age: '3 hours ago',
          comments: '2',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].story_type).toBe('job');
      expect(result[0].title).toContain('Hiring');
    });

    test('should default to "story" type', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '999',
          title: 'Regular tech article',
          url: 'https://techblog.com/article',
          score: '100',
          author: 'writer',
          age: '30 minutes ago',
          comments: '25',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].story_type).toBe('story');
    });
  });

  describe('Item ID Extraction', () => {
    test('should extract item_id from vote link', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '12345678',
          title: 'Test Story',
          url: 'https://example.com',
          score: '42',
          author: 'testuser',
          age: '1 hour ago',
          comments: '10',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].item_id).toBe('12345678');
    });

    test('should skip items without item_id', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr class="athing">
                <td class="title">
                  <span class="titleline">
                    <a href="https://example.com">Story without ID</a>
                  </span>
                </td>
              </tr>
              <tr>
                <td class="subtext">
                  <span class="score">10 points</span>
                  <a class="hnuser">user</a>
                  <span class="age">1 hour ago</span>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('Data Extraction', () => {
    test('should extract all story fields correctly', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '48100123',
          title: 'Amazing Technology Breakthrough',
          url: 'https://techsite.com/article',
          score: '250',
          author: 'scientist',
          age: '5 hours ago',
          comments: '87',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        item_id: '48100123',
        title: 'Amazing Technology Breakthrough',
        url: 'https://techsite.com/article',
        score: '250',
        author: 'scientist',
        age_text: '5 hours ago',
        comment_count: '87',
        story_type: 'story',
      });
    });

    test('should handle self-posts (null URL)', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '48100456',
          title: 'Ask HN: Self post question',
          url: 'item?id=48100456', // Relative URL indicates self-post
          score: '15',
          author: 'questioner',
          age: '2 hours ago',
          comments: '8',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBeNull();
      expect(result[0].story_type).toBe('ask');
    });

    test('should handle stories with no comments', async () => {
      const mockHtml = createMockHNPage([
        {
          id: '48100789',
          title: 'New Story',
          url: 'https://example.com',
          score: '1',
          author: 'newuser',
          age: '1 minute ago',
          comments: '0',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].comment_count).toBe('0');
    });

    test('should handle missing score as "0"', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr class="athing" id="12345">
                <td valign="top" class="votelinks">
                  <center><a id="up_12345"><div class="votearrow"></div></a></center>
                </td>
                <td class="title">
                  <span class="titleline">
                    <a href="https://example.com">Story</a>
                  </span>
                </td>
              </tr>
              <tr>
                <td colspan="2"></td>
                <td class="subtext">
                  <a class="hnuser">user</a>
                  <span class="age">1 hour ago</span>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHtml });

      const result = await scrapeHN(1);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe('0');
    });
  });

  describe('Pagination - "More" Link Extraction', () => {
    test('should extract "More" link with cursor-based URL', async () => {
      const page1Html = createMockHNPageWithMoreLink(
        [
          {
            id: '1001',
            title: 'Story 1',
            url: 'https://example1.com',
            score: '10',
            author: 'user1',
            age: '1 hour ago',
            comments: '5',
          },
        ],
        'newest?next=48100144&n=31'
      );

      const page2Html = createMockHNPage([
        {
          id: '1002',
          title: 'Story 2',
          url: 'https://example2.com',
          score: '20',
          author: 'user2',
          age: '2 hours ago',
          comments: '10',
        },
      ]);

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: page1Html })
        .mockResolvedValueOnce({ data: page2Html });

      const result = await scrapeHN(2);

      expect(result).toHaveLength(2);
      expect(result[0].item_id).toBe('1001');
      expect(result[1].item_id).toBe('1002');

      // Verify axios was called with correct URLs
      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(axios.get).toHaveBeenNthCalledWith(
        1,
        'https://news.ycombinator.com/newest',
        expect.any(Object)
      );
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://news.ycombinator.com/newest?next=48100144&n=31',
        expect.any(Object)
      );
    });

    test('should handle absolute URL in "More" link', async () => {
      const page1Html = createMockHNPageWithMoreLink(
        [
          {
            id: '2001',
            title: 'Story',
            url: 'https://example.com',
            score: '5',
            author: 'user',
            age: '1h',
            comments: '2',
          },
        ],
        'https://news.ycombinator.com/newest?next=123&n=31'
      );

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: page1Html })
        .mockResolvedValueOnce({ data: createMockHNPage([]) });

      await scrapeHN(2);

      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://news.ycombinator.com/newest?next=123&n=31',
        expect.any(Object)
      );
    });

    test('should handle relative URL with leading slash', async () => {
      const page1Html = createMockHNPageWithMoreLink(
        [
          {
            id: '3001',
            title: 'Story',
            url: 'https://example.com',
            score: '5',
            author: 'user',
            age: '1h',
            comments: '2',
          },
        ],
        '/newest?next=456&n=31'
      );

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: page1Html })
        .mockResolvedValueOnce({ data: createMockHNPage([]) });

      await scrapeHN(2);

      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'https://news.ycombinator.com/newest?next=456&n=31',
        expect.any(Object)
      );
    });

    test('should stop when no "More" link is found', async () => {
      const page1Html = createMockHNPage([
        {
          id: '4001',
          title: 'Last Story',
          url: 'https://example.com',
          score: '5',
          author: 'user',
          age: '1h',
          comments: '2',
        },
      ]);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: page1Html });

      const result = await scrapeHN(5); // Request 5 pages but only 1 available

      expect(result).toHaveLength(1);
      expect(axios.get).toHaveBeenCalledTimes(1); // Should not attempt more pages
    });
  });

  describe('Multi-page Scraping', () => {
    test('should scrape multiple pages following "More" links', async () => {
      const page1Html = createMockHNPageWithMoreLink(
        [
          {
            id: '5001',
            title: 'Story 1',
            url: 'https://ex1.com',
            score: '10',
            author: 'user1',
            age: '1h',
            comments: '5',
          },
          {
            id: '5002',
            title: 'Story 2',
            url: 'https://ex2.com',
            score: '20',
            author: 'user2',
            age: '2h',
            comments: '10',
          },
        ],
        'newest?next=5003&n=3'
      );

      const page2Html = createMockHNPageWithMoreLink(
        [
          {
            id: '5003',
            title: 'Story 3',
            url: 'https://ex3.com',
            score: '30',
            author: 'user3',
            age: '3h',
            comments: '15',
          },
          {
            id: '5004',
            title: 'Story 4',
            url: 'https://ex4.com',
            score: '40',
            author: 'user4',
            age: '4h',
            comments: '20',
          },
        ],
        'newest?next=5005&n=5'
      );

      const page3Html = createMockHNPage([
        {
          id: '5005',
          title: 'Story 5',
          url: 'https://ex5.com',
          score: '50',
          author: 'user5',
          age: '5h',
          comments: '25',
        },
      ]);

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: page1Html })
        .mockResolvedValueOnce({ data: page2Html })
        .mockResolvedValueOnce({ data: page3Html });

      const result = await scrapeHN(3);

      expect(result).toHaveLength(5);
      expect(result.map((s) => s.item_id)).toEqual(['5001', '5002', '5003', '5004', '5005']);
      expect(axios.get).toHaveBeenCalledTimes(3);
    });

    test('should respect maxPages parameter', async () => {
      const mockHtml = createMockHNPageWithMoreLink(
        [
          {
            id: '6001',
            title: 'Story',
            url: 'https://example.com',
            score: '5',
            author: 'user',
            age: '1h',
            comments: '2',
          },
        ],
        'newest?next=6002&n=2'
      );

      vi.mocked(axios.get).mockResolvedValue({ data: mockHtml });

      await scrapeHN(2);

      expect(axios.get).toHaveBeenCalledTimes(2); // Should stop at maxPages
    });

    test('should handle default maxPages (2)', async () => {
      const mockHtml = createMockHNPageWithMoreLink(
        [
          {
            id: '7001',
            title: 'Story',
            url: 'https://example.com',
            score: '5',
            author: 'user',
            age: '1h',
            comments: '2',
          },
        ],
        'newest?next=7002&n=2'
      );

      vi.mocked(axios.get).mockResolvedValue({ data: mockHtml });

      await scrapeHN(); // No parameter = default 2 pages

      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('should return empty array on network error', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      const result = await scrapeHN(1);

      expect(result).toEqual([]);
    });

    test('should return empty array on timeout', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Timeout'));

      const result = await scrapeHN(1);

      expect(result).toEqual([]);
    });

    test('should continue scraping if one page fails', async () => {
      const page1Html = createMockHNPageWithMoreLink(
        [
          {
            id: '8001',
            title: 'Story 1',
            url: 'https://ex1.com',
            score: '10',
            author: 'user1',
            age: '1h',
            comments: '5',
          },
        ],
        'newest?next=8002&n=2'
      );

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: page1Html })
        .mockRejectedValueOnce(new Error('Page 2 failed'));

      const result = await scrapeHN(2);

      expect(result).toHaveLength(1);
      expect(result[0].item_id).toBe('8001');
    });

    test('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><p>Not a valid HN page</p></body></html>';

      vi.mocked(axios.get).mockResolvedValueOnce({ data: malformedHtml });

      const result = await scrapeHN(1);

      expect(result).toEqual([]);
    });
  });
});

// Helper function to create mock HN HTML
function createMockHNPage(
  stories: Array<{
    id: string;
    title: string;
    url: string | null;
    score: string;
    author: string;
    age: string;
    comments: string;
  }>
): string {
  const storiesHtml = stories
    .map(
      (story) => `
    <tr class="athing" id="${story.id}">
      <td align="right" valign="top" class="title"><span class="rank">1.</span></td>
      <td valign="top" class="votelinks">
        <center><a id="up_${story.id}" href="vote?id=${story.id}"><div class="votearrow"></div></a></center>
      </td>
      <td class="title">
        <span class="titleline">
          <a href="${story.url || `item?id=${story.id}`}">${story.title}</a>
        </span>
      </td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="subtext">
        <span class="subline">
          ${story.score !== '0' ? `<span class="score" id="score_${story.id}">${story.score} points</span>` : ''}
          by <a href="user?id=${story.author}" class="hnuser">${story.author}</a>
          <span class="age" title="2026-05-11T10:00:00"><a href="item?id=${story.id}">${story.age}</a></span>
          | <a href="hide?id=${story.id}">hide</a>
          ${story.comments !== '0' ? `| <a href="item?id=${story.id}">${story.comments}&nbsp;comments</a>` : '| <a href="item?id=${story.id}">discuss</a>'}
        </span>
      </td>
    </tr>
    <tr class="spacer" style="height:5px"></tr>
  `
    )
    .join('');

  return `
    <html lang="en" op="newest">
      <head><title>New Links | Hacker News</title></head>
      <body>
        <center>
          <table id="hnmain">
            <tr><td><table>${storiesHtml}</table></td></tr>
          </table>
        </center>
      </body>
    </html>
  `;
}

// Helper function to create mock HN HTML with "More" link
function createMockHNPageWithMoreLink(
  stories: Array<{
    id: string;
    title: string;
    url: string | null;
    score: string;
    author: string;
    age: string;
    comments: string;
  }>,
  moreHref: string
): string {
  const storiesHtml = stories
    .map(
      (story) => `
    <tr class="athing" id="${story.id}">
      <td align="right" valign="top" class="title"><span class="rank">1.</span></td>
      <td valign="top" class="votelinks">
        <center><a id="up_${story.id}"><div class="votearrow"></div></a></center>
      </td>
      <td class="title">
        <span class="titleline">
          <a href="${story.url || `item?id=${story.id}`}">${story.title}</a>
        </span>
      </td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="subtext">
        <span class="score">${story.score} points</span>
        by <a class="hnuser">${story.author}</a>
        <span class="age">${story.age}</span>
        | <a href="item?id=${story.id}">${story.comments}&nbsp;comments</a>
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <html>
      <body>
        <table>
          ${storiesHtml}
          <tr class="morespace" style="height:10px"></tr>
          <tr>
            <td colspan="2"></td>
            <td class="title">
              <a href="${moreHref}" class="morelink" rel="next">More</a>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
