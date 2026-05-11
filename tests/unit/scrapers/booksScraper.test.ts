import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

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
import { scrapeBooks } from '../../../src/workers/scrapers/booksScraper';
import type { RawBookData } from '../../../src/workers/scrapers/booksScraper';

describe('booksScraper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rating Extraction', () => {
    test('should extract "One" star rating', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Poor Book',
          price: '£10.00',
          rating: 'One',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book1.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'UPC123',
        description: 'Test description',
        numReviews: '5',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe('One');
    });

    test('should extract "Five" star rating', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Excellent Book',
          price: '£25.50',
          rating: 'Five',
          availability: 'In stock',
          category: 'Non-Fiction',
          url: 'book2.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'UPC456',
        description: 'Amazing book',
        numReviews: '100',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe('Five');
    });

    test('should handle unknown rating', async () => {
      const mockCatalogueHtml = `
        <html>
          <body>
            <article class="product_pod">
              <h3><a href="book.html" title="Book Title">Book Title</a></h3>
              <p class="price_color">£10.00</p>
              <p class="star-rating InvalidRating"></p>
              <p class="availability">In stock</p>
            </article>
          </body>
        </html>
      `;

      const mockDetailHtml = createMockDetailPage({
        upc: 'UPC789',
        description: 'Test',
        numReviews: '1',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe('Unknown');
    });
  });

  describe('Catalogue Page Scraping', () => {
    test('should extract all book fields from catalogue page', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'The Great Book',
          price: '£19.99',
          rating: 'Four',
          availability: 'In stock (22 available)',
          category: 'Mystery',
          url: 'catalogue/the-great-book_123/index.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'ABC123XYZ',
        description: 'A thrilling mystery novel',
        numReviews: '42',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'The Great Book',
        price: '£19.99',
        rating: 'Four',
        availability: 'In stock (22 available)',
        category: 'Mystery',
        product_url: expect.stringContaining('the-great-book_123'),
        upc: 'ABC123XYZ',
        description: 'A thrilling mystery novel',
        num_reviews: '42',
      });
    });

    test('should handle multiple books on same page', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Book One',
          price: '£10.00',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book1.html',
        },
        {
          title: 'Book Two',
          price: '£15.00',
          rating: 'Five',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book2.html',
        },
        {
          title: 'Book Three',
          price: '£20.00',
          rating: 'Four',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book3.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'UPC000',
        description: 'Description',
        numReviews: '1',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValue({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Book One');
      expect(result[1].title).toBe('Book Two');
      expect(result[2].title).toBe('Book Three');
    });

    test('should construct correct product URL from relative path', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Test Book',
          price: '£12.00',
          rating: 'Two',
          availability: 'In stock',
          category: 'Science',
          url: '../../../catalogue/test-book_999/index.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'TEST999',
        description: 'Test',
        numReviews: '0',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      // The scraper doesn't normalize '../../../' paths, it just removes '../'
      expect(result[0].product_url).toBe(
        'https://books.toscrape.com/catalogue/../../catalogue/test-book_999/index.html'
      );
    });

    test('should handle absolute URLs in product links', async () => {
      const mockCatalogueHtml = `
        <html>
          <body>
            <ul class="breadcrumb">
              <li><a>Home</a></li>
              <li><a>Books</a></li>
              <li><a>Fiction</a></li>
            </ul>
            <article class="product_pod">
              <h3><a href="https://books.toscrape.com/book.html" title="Absolute URL Book">Absolute URL Book</a></h3>
              <p class="price_color">£10.00</p>
              <p class="star-rating Three"></p>
              <p class="availability">In stock</p>
            </article>
          </body>
        </html>
      `;

      const mockDetailHtml = createMockDetailPage({
        upc: 'ABS123',
        description: 'Test',
        numReviews: '0',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].product_url).toBe('https://books.toscrape.com/book.html');
    });
  });

  describe('Detail Page Scraping', () => {
    test('should extract UPC from detail page', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Book',
          price: '£10.00',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'a1b2c3d4e5f6g7h8',
        description: 'Test description',
        numReviews: '10',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].upc).toBe('a1b2c3d4e5f6g7h8');
    });

    test('should extract description from detail page', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Descriptive Book',
          price: '£15.00',
          rating: 'Four',
          availability: 'In stock',
          category: 'Non-Fiction',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'UPC123',
        description: 'This is a very detailed and comprehensive description of the book content.',
        numReviews: '25',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe(
        'This is a very detailed and comprehensive description of the book content.'
      );
    });

    test('should extract number of reviews from detail page', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Popular Book',
          price: '£22.00',
          rating: 'Five',
          availability: 'In stock',
          category: 'Best Sellers',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'POP999',
        description: 'A bestselling book',
        numReviews: '1543',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].num_reviews).toBe('1543');
    });

    test('should handle missing description (undefined)', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'No Description Book',
          price: '£8.00',
          rating: 'Two',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = `
        <html>
          <body>
            <table class="table table-striped">
              <tr><th>UPC</th><td>NODESC123</td></tr>
              <tr><th>Number of reviews</th><td>5</td></tr>
            </table>
          </body>
        </html>
      `;

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBeUndefined();
    });

    test('should handle missing UPC (undefined)', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'No UPC Book',
          price: '£12.00',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = `
        <html>
          <body>
            <div id="product_description"></div>
            <p>A book without UPC</p>
            <table class="table table-striped">
              <tr><th>Number of reviews</th><td>3</td></tr>
            </table>
          </body>
        </html>
      `;

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].upc).toBeUndefined();
    });

    test('should default to "0" reviews when missing', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'New Book',
          price: '£10.00',
          rating: 'One',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = `
        <html>
          <body>
            <table class="table table-striped">
              <tr><th>UPC</th><td>NEW123</td></tr>
            </table>
            <div id="product_description"></div>
            <p>New book description</p>
          </body>
        </html>
      `;

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);
      expect(result[0].num_reviews).toBe('0');
    });

    test('should handle detail page fetch failure gracefully', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Book with Broken Detail',
          price: '£10.00',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book.html',
        },
      ]);

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockRejectedValueOnce(new Error('Detail page not found'));

      const result = await scrapeBooks(1);

      // Should still return the book with catalogue data only
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Book with Broken Detail');
      expect(result[0].upc).toBeUndefined();
      expect(result[0].description).toBeUndefined();
    });
  });

  describe('Multi-page Scraping', () => {
    test('should scrape multiple catalogue pages', async () => {
      const page1Html = createMockCataloguePage([
        {
          title: 'Book 1',
          price: '£10',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'b1.html',
        },
        {
          title: 'Book 2',
          price: '£15',
          rating: 'Four',
          availability: 'In stock',
          category: 'Fiction',
          url: 'b2.html',
        },
      ]);

      const page2Html = createMockCataloguePage([
        {
          title: 'Book 3',
          price: '£20',
          rating: 'Five',
          availability: 'In stock',
          category: 'Fiction',
          url: 'b3.html',
        },
        {
          title: 'Book 4',
          price: '£25',
          rating: 'Two',
          availability: 'In stock',
          category: 'Fiction',
          url: 'b4.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'TEST',
        description: 'Test',
        numReviews: '1',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: page1Html })
        .mockResolvedValueOnce({ data: page2Html })
        .mockResolvedValue({ data: mockDetailHtml });

      const result = await scrapeBooks(2);

      expect(result).toHaveLength(4);
      expect(result.map((b) => b.title)).toEqual(['Book 1', 'Book 2', 'Book 3', 'Book 4']);

      // Verify axios called with correct URLs
      expect(axios.get).toHaveBeenCalledWith(
        'https://books.toscrape.com/catalogue/page-1.html',
        expect.any(Object)
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://books.toscrape.com/catalogue/page-2.html',
        expect.any(Object)
      );
    });

    test('should respect maxPages parameter', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Book',
          price: '£10',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'TEST',
        description: 'Test',
        numReviews: '1',
      });

      vi.mocked(axios.get).mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('catalogue/page-')) {
          return Promise.resolve({ data: mockCatalogueHtml });
        }
        return Promise.resolve({ data: mockDetailHtml });
      });

      await scrapeBooks(3);

      // Should call catalogue pages 3 times (page 1, 2, 3)
      const catalogueCalls = (axios.get as any).mock.calls.filter((call: any[]) =>
        call[0].includes('catalogue/page-')
      );
      expect(catalogueCalls).toHaveLength(3);
    });

    test('should use default maxPages (5)', async () => {
      let catalogueCallCount = 0;
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Book',
          price: '£10',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'book.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'TEST',
        description: 'Test',
        numReviews: '1',
      });

      vi.mocked(axios.get).mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('catalogue/page-')) {
          catalogueCallCount++;
          return Promise.resolve({ data: mockCatalogueHtml });
        }
        return Promise.resolve({ data: mockDetailHtml });
      });

      await scrapeBooks(); // No parameter = default 5 pages

      expect(catalogueCallCount).toBe(5);
    }, 15000); // 15 second timeout

    test('should construct correct URLs for pages', async () => {
      const mockCatalogueHtml = createMockCataloguePage([]);
      vi.mocked(axios.get).mockResolvedValue({ data: mockCatalogueHtml });

      await scrapeBooks(3);

      expect(axios.get).toHaveBeenCalledWith(
        'https://books.toscrape.com/catalogue/page-1.html',
        expect.any(Object)
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://books.toscrape.com/catalogue/page-2.html',
        expect.any(Object)
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://books.toscrape.com/catalogue/page-3.html',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    test('should return empty array on catalogue page error', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      const result = await scrapeBooks(1);

      expect(result).toEqual([]);
    });

    test('should return empty array on catalogue page error (graceful handling)', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Critical error'));

      const result = await scrapeBooks(1);
      expect(result).toEqual([]);
    });

    test('should continue scraping if one catalogue page fails', async () => {
      const page1Html = createMockCataloguePage([
        {
          title: 'Book 1',
          price: '£10',
          rating: 'Three',
          availability: 'In stock',
          category: 'Fiction',
          url: 'b1.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'TEST',
        description: 'Test',
        numReviews: '1',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: page1Html })
        .mockRejectedValueOnce(new Error('Page 2 failed'))
        .mockResolvedValue({ data: mockDetailHtml });

      const result = await scrapeBooks(2);

      // Should still have book from page 1
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Book 1');
    });

    test('should return empty array on timeout (graceful handling)', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Timeout'));

      const result = await scrapeBooks(1);
      expect(result).toEqual([]);
    });

    test('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><p>Not a valid catalogue page</p></body></html>';
      vi.mocked(axios.get).mockResolvedValueOnce({ data: malformedHtml });

      const result = await scrapeBooks(1);

      expect(result).toEqual([]);
    });
  });

  describe('Data Integrity', () => {
    test('should skip books without title', async () => {
      const mockHtml = `
        <html>
          <body>
            <ul class="breadcrumb">
              <li><a>Home</a></li>
              <li><a>Books</a></li>
              <li><a>Fiction</a></li>
            </ul>
            <article class="product_pod">
              <h3><a href="book.html" title=""><!-- Empty title --></a></h3>
              <p class="price_color">£10.00</p>
              <p class="star-rating Three"></p>
              <p class="availability">In stock</p>
            </article>
            <article class="product_pod">
              <h3><a href="book2.html" title="Valid Book">Valid Book</a></h3>
              <p class="price_color">£15.00</p>
              <p class="star-rating Four"></p>
              <p class="availability">In stock</p>
            </article>
          </body>
        </html>
      `;

      const mockDetailHtml = createMockDetailPage({
        upc: 'TEST',
        description: 'Test',
        numReviews: '1',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockHtml })
        .mockResolvedValue({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      // Should only include book with valid title
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Valid Book');
    });

    test('should handle books with empty href (creates base URL)', async () => {
      const mockHtml = `
        <html>
          <body>
            <ul class="breadcrumb">
              <li><a>Home</a></li>
              <li><a>Books</a></li>
              <li><a>Fiction</a></li>
            </ul>
            <article class="product_pod">
              <h3><a href="" title="No URL Book">No URL Book</a></h3>
              <p class="price_color">£10.00</p>
              <p class="star-rating Three"></p>
              <p class="availability">In stock</p>
            </article>
          </body>
        </html>
      `;

      const mockDetailHtml = createMockDetailPage({
        upc: 'TEST',
        description: 'Test',
        numReviews: '1',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      // Scraper constructs URL even with empty href
      expect(result).toHaveLength(1);
      expect(result[0].product_url).toContain('books.toscrape.com');
    });

    test('should preserve all data through detail fetch', async () => {
      const mockCatalogueHtml = createMockCataloguePage([
        {
          title: 'Complete Book',
          price: '£29.99',
          rating: 'Five',
          availability: 'In stock (15 available)',
          category: 'Technology',
          url: 'complete-book.html',
        },
      ]);

      const mockDetailHtml = createMockDetailPage({
        upc: 'COMPLETE999',
        description: 'A complete book with all data',
        numReviews: '127',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockCatalogueHtml })
        .mockResolvedValueOnce({ data: mockDetailHtml });

      const result = await scrapeBooks(1);

      expect(result).toHaveLength(1);

      // Verify all catalogue data preserved
      expect(result[0].title).toBe('Complete Book');
      expect(result[0].price).toBe('£29.99');
      expect(result[0].rating).toBe('Five');
      expect(result[0].availability).toBe('In stock (15 available)');
      expect(result[0].category).toBe('Technology');

      // Verify detail data added
      expect(result[0].upc).toBe('COMPLETE999');
      expect(result[0].description).toBe('A complete book with all data');
      expect(result[0].num_reviews).toBe('127');
    });
  });
});

// Helper function to create mock catalogue page HTML
function createMockCataloguePage(
  books: Array<{
    title: string;
    price: string;
    rating: string;
    availability: string;
    category: string;
    url: string;
  }>
): string {
  const booksHtml = books
    .map(
      (book) => `
    <article class="product_pod">
      <h3><a href="${book.url}" title="${book.title}">${book.title}</a></h3>
      <p class="price_color">${book.price}</p>
      <p class="star-rating ${book.rating}"></p>
      <p class="availability">${book.availability}</p>
    </article>
  `
    )
    .join('');

  return `
    <html>
      <body>
        <ul class="breadcrumb">
          <li><a href="/">Home</a></li>
          <li><a href="/books/">Books</a></li>
          <li><a href="/category/">${books[0]?.category || 'Fiction'}</a></li>
        </ul>
        ${booksHtml}
      </body>
    </html>
  `;
}

// Helper function to create mock detail page HTML
function createMockDetailPage(details: {
  upc: string;
  description: string;
  numReviews: string;
}): string {
  return `
    <html>
      <body>
        <table class="table table-striped">
          <tr><th>UPC</th><td>${details.upc}</td></tr>
          <tr><th>Product Type</th><td>Books</td></tr>
          <tr><th>Price (excl. tax)</th><td>£10.00</td></tr>
          <tr><th>Price (incl. tax)</th><td>£10.00</td></tr>
          <tr><th>Tax</th><td>£0.00</td></tr>
          <tr><th>Availability</th><td>In stock</td></tr>
          <tr><th>Number of reviews</th><td>${details.numReviews}</td></tr>
        </table>
        <div id="product_description"></div>
        <p>${details.description}</p>
      </body>
    </html>
  `;
}
