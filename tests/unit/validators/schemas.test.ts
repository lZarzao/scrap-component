import { describe, it, expect } from 'vitest';
import {
  RawBookSchema,
  CleanBookSchema,
  RawHNStorySchema,
  CleanHNStorySchema,
  StoryTypeEnum,
} from '../../../src/types/schemas';
import { z } from 'zod';

describe('schemas', () => {
  describe('RawBookSchema', () => {
    it('should validate correct raw book data', () => {
      const validBook = {
        title: 'Harry Potter',
        price: '£45.50',
        rating: 'Five',
        availability: 'In stock (22 available)',
        category: 'Fiction',
        upc: '1234567890123',
        description: 'A magical story',
        num_reviews: 100,
      };

      const result = RawBookSchema.parse(validBook);
      expect(result).toEqual(validBook);
    });

    it('should accept numeric rating', () => {
      const book = {
        title: 'Test Book',
        price: '£10.00',
        rating: 3,
        availability: 'In stock',
        category: 'Test',
        upc: '1234567890123',
        num_reviews: 0,
      };

      const result = RawBookSchema.parse(book);
      expect(result.rating).toBe(3);
    });

    it('should convert string num_reviews to number', () => {
      const book = {
        title: 'Test Book',
        price: '£10.00',
        rating: 3,
        availability: 'In stock',
        category: 'Test',
        upc: '1234567890123',
        num_reviews: '50',
      };

      const result = RawBookSchema.parse(book);
      expect(result.num_reviews).toBe(50);
    });

    it('should default num_reviews to 0 if not provided', () => {
      const book = {
        title: 'Test Book',
        price: '£10.00',
        rating: 3,
        availability: 'In stock',
        category: 'Test',
        upc: '1234567890123',
      };

      const result = RawBookSchema.parse(book);
      expect(result.num_reviews).toBe(0);
    });

    it('should accept null description', () => {
      const book = {
        title: 'Test Book',
        price: '£10.00',
        rating: 3,
        availability: 'In stock',
        category: 'Test',
        upc: '1234567890123',
        description: null,
        num_reviews: 0,
      };

      const result = RawBookSchema.parse(book);
      expect(result.description).toBeNull();
    });

    it('should reject empty title', () => {
      const book = {
        title: '',
        price: '£10.00',
        rating: 3,
        availability: 'In stock',
        category: 'Test',
        upc: '1234567890123',
        num_reviews: 0,
      };

      expect(() => RawBookSchema.parse(book)).toThrow(z.ZodError);
    });

    it('should reject title too long', () => {
      const book = {
        title: 'x'.repeat(501),
        price: '£10.00',
        rating: 3,
        availability: 'In stock',
        category: 'Test',
        upc: '1234567890123',
        num_reviews: 0,
      };

      expect(() => RawBookSchema.parse(book)).toThrow(z.ZodError);
    });

    it('should reject negative num_reviews', () => {
      const book = {
        title: 'Test',
        price: '£10.00',
        rating: 3,
        availability: 'In stock',
        category: 'Test',
        upc: '1234567890123',
        num_reviews: -5,
      };

      expect(() => RawBookSchema.parse(book)).toThrow(z.ZodError);
    });
  });

  describe('CleanBookSchema', () => {
    it('should validate correct clean book data', () => {
      const validBook = {
        upc: '1234567890123',
        title: 'Harry Potter',
        price_gbp: 45.5,
        rating: 5,
        category: 'Fiction',
        available: true,
        description: 'A magical story',
        num_reviews: 100,
      };

      const result = CleanBookSchema.parse(validBook);
      expect(result).toEqual(validBook);
    });

    it('should reject rating below 1', () => {
      const book = {
        upc: '1234567890123',
        title: 'Test',
        price_gbp: 10.0,
        rating: 0,
        category: 'Test',
        available: true,
        description: null,
        num_reviews: 0,
      };

      expect(() => CleanBookSchema.parse(book)).toThrow(z.ZodError);
    });

    it('should reject rating above 5', () => {
      const book = {
        upc: '1234567890123',
        title: 'Test',
        price_gbp: 10.0,
        rating: 6,
        category: 'Test',
        available: true,
        description: null,
        num_reviews: 0,
      };

      expect(() => CleanBookSchema.parse(book)).toThrow(z.ZodError);
    });

    it('should reject non-integer rating', () => {
      const book = {
        upc: '1234567890123',
        title: 'Test',
        price_gbp: 10.0,
        rating: 3.5,
        category: 'Test',
        available: true,
        description: null,
        num_reviews: 0,
      };

      expect(() => CleanBookSchema.parse(book)).toThrow(z.ZodError);
    });

    it('should reject negative price', () => {
      const book = {
        upc: '1234567890123',
        title: 'Test',
        price_gbp: -10.0,
        rating: 3,
        category: 'Test',
        available: true,
        description: null,
        num_reviews: 0,
      };

      expect(() => CleanBookSchema.parse(book)).toThrow(z.ZodError);
    });

    it('should reject zero price', () => {
      const book = {
        upc: '1234567890123',
        title: 'Test',
        price_gbp: 0,
        rating: 3,
        category: 'Test',
        available: true,
        description: null,
        num_reviews: 0,
      };

      expect(() => CleanBookSchema.parse(book)).toThrow(z.ZodError);
    });

    it('should default num_reviews to 0', () => {
      const book = {
        upc: '1234567890123',
        title: 'Test',
        price_gbp: 10.0,
        rating: 3,
        category: 'Test',
        available: true,
      };

      const result = CleanBookSchema.parse(book);
      expect(result.num_reviews).toBe(0);
    });
  });

  describe('RawHNStorySchema', () => {
    it('should validate correct raw HN story data', () => {
      const validStory = {
        item_id: 12345678,
        title: 'A new programming language',
        url: 'https://example.com',
        score: 150,
        author: 'johndoe',
        age_text: '2 hours ago',
        comment_count: 45,
      };

      const result = RawHNStorySchema.parse(validStory);
      expect(result).toEqual(validStory);
    });

    it('should accept null url', () => {
      const story = {
        item_id: 12345678,
        title: 'Ask HN: Question',
        url: null,
        score: 50,
        author: 'user',
        age_text: '1 hour ago',
        comment_count: 10,
      };

      const result = RawHNStorySchema.parse(story);
      expect(result.url).toBeNull();
    });

    it('should default score to 0 if not provided', () => {
      const story = {
        item_id: 12345678,
        title: 'Test',
        author: 'user',
        age_text: '1 hour ago',
        comment_count: 0,
      };

      const result = RawHNStorySchema.parse(story);
      expect(result.score).toBe(0);
    });

    it('should default comment_count to 0 if not provided', () => {
      const story = {
        item_id: 12345678,
        title: 'Test',
        author: 'user',
        age_text: '1 hour ago',
        score: 50,
      };

      const result = RawHNStorySchema.parse(story);
      expect(result.comment_count).toBe(0);
    });

    it('should reject invalid item_id', () => {
      const story = {
        item_id: -1,
        title: 'Test',
        author: 'user',
        age_text: '1 hour ago',
        score: 50,
        comment_count: 0,
      };

      expect(() => RawHNStorySchema.parse(story)).toThrow(z.ZodError);
    });

    it('should reject invalid url', () => {
      const story = {
        item_id: 12345678,
        title: 'Test',
        url: 'not-a-valid-url',
        author: 'user',
        age_text: '1 hour ago',
        score: 50,
        comment_count: 0,
      };

      expect(() => RawHNStorySchema.parse(story)).toThrow(z.ZodError);
    });

    it('should reject negative score', () => {
      const story = {
        item_id: 12345678,
        title: 'Test',
        author: 'user',
        age_text: '1 hour ago',
        score: -10,
        comment_count: 0,
      };

      expect(() => RawHNStorySchema.parse(story)).toThrow(z.ZodError);
    });
  });

  describe('CleanHNStorySchema', () => {
    it('should validate correct clean HN story data', () => {
      const validStory = {
        hn_item_id: 12345678,
        title: 'A new programming language',
        url: 'https://example.com',
        score: 150,
        author: 'johndoe',
        age_text: '2 hours ago',
        comment_count: 45,
        story_type: 'story',
      };

      const result = CleanHNStorySchema.parse(validStory);
      expect(result).toEqual(validStory);
    });

    it('should accept all story types', () => {
      const types = ['story', 'ask', 'show', 'job'];

      types.forEach((story_type) => {
        const story = {
          hn_item_id: 12345678,
          title: 'Test',
          url: 'https://example.com',
          score: 50,
          author: 'user',
          age_text: '1h ago',
          comment_count: 10,
          story_type,
        };

        const result = CleanHNStorySchema.parse(story);
        expect(result.story_type).toBe(story_type);
      });
    });

    it('should reject invalid story_type', () => {
      const story = {
        hn_item_id: 12345678,
        title: 'Test',
        url: 'https://example.com',
        score: 50,
        author: 'user',
        age_text: '1h ago',
        comment_count: 10,
        story_type: 'invalid',
      };

      expect(() => CleanHNStorySchema.parse(story)).toThrow(z.ZodError);
    });
  });

  describe('StoryTypeEnum', () => {
    it('should accept valid story types', () => {
      const validTypes = ['story', 'ask', 'show', 'job'];

      validTypes.forEach((type) => {
        const result = StoryTypeEnum.parse(type);
        expect(result).toBe(type);
      });
    });

    it('should reject invalid story types', () => {
      const invalidTypes = ['invalid', 'post', 'article', ''];

      invalidTypes.forEach((type) => {
        expect(() => StoryTypeEnum.parse(type)).toThrow(z.ZodError);
      });
    });
  });
});
