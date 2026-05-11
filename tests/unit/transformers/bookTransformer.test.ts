import { describe, it, expect } from 'vitest';
import { transformBook, transformBooks } from '../../../src/transformer/bookTransformer';
import { z } from 'zod';

describe('bookTransformer', () => {
  describe('transformBook', () => {
    it('should transform valid raw book data', () => {
      const rawBook = {
        upc: '1234567890123',
        title: '  Harry Potter  ',
        price: '£45.50',
        rating: 'Five',
        category: '  Fiction  ',
        availability: 'In stock (22 available)',
        description: '  A young wizard story  ',
        num_reviews: 1203,
      };

      const result = transformBook(rawBook);

      expect(result).toEqual({
        upc: '1234567890123',
        title: 'Harry Potter',
        price_gbp: 45.5,
        rating: 5,
        category: 'Fiction',
        available: true,
        description: 'A young wizard story',
        num_reviews: 1203,
      });
    });

    it('should handle null description', () => {
      const rawBook = {
        upc: '1234567890123',
        title: 'Test Book',
        price: '£25.99',
        rating: 'Three',
        category: 'Fiction',
        availability: 'In stock',
        description: null,
        num_reviews: 50,
      };

      const result = transformBook(rawBook);

      expect(result.description).toBeNull();
    });

    it('should parse different price formats', () => {
      const testCases = [
        { input: '£45.50', expected: 45.5 },
        { input: '$12.99', expected: 12.99 },
        { input: '€99.00', expected: 99.0 },
        { input: '123.45', expected: 123.45 },
      ];

      for (const testCase of testCases) {
        const rawBook = {
          upc: '1234567890123',
          title: 'Test',
          price: testCase.input,
          rating: 3,
          category: 'Test',
          availability: 'In stock',
          description: null,
          num_reviews: 0,
        };

        const result = transformBook(rawBook);
        expect(result.price_gbp).toBe(testCase.expected);
      }
    });

    it('should parse text ratings', () => {
      const ratings = ['One', 'Two', 'Three', 'Four', 'Five'];

      ratings.forEach((rating, index) => {
        const rawBook = {
          upc: '1234567890123',
          title: 'Test',
          price: '£10.00',
          rating,
          category: 'Test',
          availability: 'In stock',
          description: null,
          num_reviews: 0,
        };

        const result = transformBook(rawBook);
        expect(result.rating).toBe(index + 1);
      });
    });

    it('should parse numeric ratings', () => {
      for (let rating = 1; rating <= 5; rating++) {
        const rawBook = {
          upc: '1234567890123',
          title: 'Test',
          price: '£10.00',
          rating,
          category: 'Test',
          availability: 'In stock',
          description: null,
          num_reviews: 0,
        };

        const result = transformBook(rawBook);
        expect(result.rating).toBe(rating);
      }
    });

    it('should parse string numeric ratings', () => {
      const rawBook = {
        upc: '1234567890123',
        title: 'Test',
        price: '£10.00',
        rating: '4',
        category: 'Test',
        availability: 'In stock',
        description: null,
        num_reviews: 0,
      };

      const result = transformBook(rawBook);
      expect(result.rating).toBe(4);
    });

    it('should parse availability correctly', () => {
      const testCases = [
        { input: 'In stock (22 available)', expected: true },
        { input: 'In stock', expected: true },
        { input: 'in stock', expected: true },
        { input: 'Out of stock', expected: false },
        { input: 'out of stock', expected: false },
        { input: 'Not available', expected: false },
      ];

      for (const testCase of testCases) {
        const rawBook = {
          upc: '1234567890123',
          title: 'Test',
          price: '£10.00',
          rating: 3,
          category: 'Test',
          availability: testCase.input,
          description: null,
          num_reviews: 0,
        };

        const result = transformBook(rawBook);
        expect(result.available).toBe(testCase.expected);
      }
    });

    it('should throw error for invalid price', () => {
      const rawBook = {
        upc: '1234567890123',
        title: 'Test',
        price: 'invalid',
        rating: 3,
        category: 'Test',
        availability: 'In stock',
        description: null,
        num_reviews: 0,
      };

      expect(() => transformBook(rawBook)).toThrow();
    });

    it('should throw error for invalid rating', () => {
      const rawBook = {
        upc: '1234567890123',
        title: 'Test',
        price: '£10.00',
        rating: 'Invalid',
        category: 'Test',
        availability: 'In stock',
        description: null,
        num_reviews: 0,
      };

      expect(() => transformBook(rawBook)).toThrow();
    });

    it('should throw error for rating out of range', () => {
      const rawBook = {
        upc: '1234567890123',
        title: 'Test',
        price: '£10.00',
        rating: 6,
        category: 'Test',
        availability: 'In stock',
        description: null,
        num_reviews: 0,
      };

      expect(() => transformBook(rawBook)).toThrow();
    });

    it('should throw error for negative price', () => {
      const rawBook = {
        upc: '1234567890123',
        title: 'Test',
        price: '£-10.00',
        rating: 3,
        category: 'Test',
        availability: 'In stock',
        description: null,
        num_reviews: 0,
      };

      expect(() => transformBook(rawBook)).toThrow();
    });

    it('should throw ZodError for missing required fields', () => {
      const rawBook = {
        upc: '1234567890123',
        title: 'Test',
        // Missing price
        rating: 3,
        category: 'Test',
        availability: 'In stock',
        num_reviews: 0,
      };

      expect(() => transformBook(rawBook)).toThrow(z.ZodError);
    });
  });

  describe('transformBooks', () => {
    it('should transform array of valid books', () => {
      const rawBooks = [
        {
          upc: '1111111111111',
          title: 'Book 1',
          price: '£10.00',
          rating: 'Three',
          category: 'Fiction',
          availability: 'In stock',
          description: 'Description 1',
          num_reviews: 10,
        },
        {
          upc: '2222222222222',
          title: 'Book 2',
          price: '£20.00',
          rating: 'Five',
          category: 'Science',
          availability: 'Out of stock',
          description: null,
          num_reviews: 5,
        },
      ];

      const result = transformBooks(rawBooks);

      expect(result).toHaveLength(2);
      expect(result[0].upc).toBe('1111111111111');
      expect(result[0].price_gbp).toBe(10.0);
      expect(result[0].rating).toBe(3);
      expect(result[1].upc).toBe('2222222222222');
      expect(result[1].price_gbp).toBe(20.0);
      expect(result[1].rating).toBe(5);
      expect(result[1].available).toBe(false);
    });

    it('should skip invalid books but continue processing', () => {
      const rawBooks = [
        {
          upc: '1111111111111',
          title: 'Valid Book',
          price: '£10.00',
          rating: 'Three',
          category: 'Fiction',
          availability: 'In stock',
          description: null,
          num_reviews: 10,
        },
        {
          // Invalid: missing price
          upc: '2222222222222',
          title: 'Invalid Book',
          rating: 'Five',
          category: 'Science',
          availability: 'In stock',
          description: null,
          num_reviews: 5,
        },
        {
          upc: '3333333333333',
          title: 'Another Valid Book',
          price: '£30.00',
          rating: 'Four',
          category: 'History',
          availability: 'In stock',
          description: null,
          num_reviews: 20,
        },
      ];

      const result = transformBooks(rawBooks);

      expect(result).toHaveLength(2);
      expect(result[0].upc).toBe('1111111111111');
      expect(result[1].upc).toBe('3333333333333');
    });

    it('should throw error when all books fail validation', () => {
      const rawBooks = [{ invalid: 'data' }, { also: 'invalid' }];

      expect(() => transformBooks(rawBooks as any)).toThrow('All 2 books failed transformation');
    });

    it('should return empty array for empty input', () => {
      const result = transformBooks([]);
      expect(result).toEqual([]);
    });
  });
});
