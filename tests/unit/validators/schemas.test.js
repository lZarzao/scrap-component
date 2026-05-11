"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const schemas_1 = require("@/types/schemas");
const zod_1 = require("zod");
(0, vitest_1.describe)('schemas', () => {
    (0, vitest_1.describe)('RawBookSchema', () => {
        (0, vitest_1.it)('should validate correct raw book data', () => {
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
            const result = schemas_1.RawBookSchema.parse(validBook);
            (0, vitest_1.expect)(result).toEqual(validBook);
        });
        (0, vitest_1.it)('should accept numeric rating', () => {
            const book = {
                title: 'Test Book',
                price: '£10.00',
                rating: 3,
                availability: 'In stock',
                category: 'Test',
                upc: '1234567890123',
                num_reviews: 0,
            };
            const result = schemas_1.RawBookSchema.parse(book);
            (0, vitest_1.expect)(result.rating).toBe(3);
        });
        (0, vitest_1.it)('should convert string num_reviews to number', () => {
            const book = {
                title: 'Test Book',
                price: '£10.00',
                rating: 3,
                availability: 'In stock',
                category: 'Test',
                upc: '1234567890123',
                num_reviews: '50',
            };
            const result = schemas_1.RawBookSchema.parse(book);
            (0, vitest_1.expect)(result.num_reviews).toBe(50);
        });
        (0, vitest_1.it)('should default num_reviews to 0 if not provided', () => {
            const book = {
                title: 'Test Book',
                price: '£10.00',
                rating: 3,
                availability: 'In stock',
                category: 'Test',
                upc: '1234567890123',
            };
            const result = schemas_1.RawBookSchema.parse(book);
            (0, vitest_1.expect)(result.num_reviews).toBe(0);
        });
        (0, vitest_1.it)('should accept null description', () => {
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
            const result = schemas_1.RawBookSchema.parse(book);
            (0, vitest_1.expect)(result.description).toBeNull();
        });
        (0, vitest_1.it)('should reject empty title', () => {
            const book = {
                title: '',
                price: '£10.00',
                rating: 3,
                availability: 'In stock',
                category: 'Test',
                upc: '1234567890123',
                num_reviews: 0,
            };
            (0, vitest_1.expect)(() => schemas_1.RawBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject title too long', () => {
            const book = {
                title: 'x'.repeat(501),
                price: '£10.00',
                rating: 3,
                availability: 'In stock',
                category: 'Test',
                upc: '1234567890123',
                num_reviews: 0,
            };
            (0, vitest_1.expect)(() => schemas_1.RawBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject negative num_reviews', () => {
            const book = {
                title: 'Test',
                price: '£10.00',
                rating: 3,
                availability: 'In stock',
                category: 'Test',
                upc: '1234567890123',
                num_reviews: -5,
            };
            (0, vitest_1.expect)(() => schemas_1.RawBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
    });
    (0, vitest_1.describe)('CleanBookSchema', () => {
        (0, vitest_1.it)('should validate correct clean book data', () => {
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
            const result = schemas_1.CleanBookSchema.parse(validBook);
            (0, vitest_1.expect)(result).toEqual(validBook);
        });
        (0, vitest_1.it)('should reject rating below 1', () => {
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
            (0, vitest_1.expect)(() => schemas_1.CleanBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject rating above 5', () => {
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
            (0, vitest_1.expect)(() => schemas_1.CleanBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject non-integer rating', () => {
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
            (0, vitest_1.expect)(() => schemas_1.CleanBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject negative price', () => {
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
            (0, vitest_1.expect)(() => schemas_1.CleanBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject zero price', () => {
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
            (0, vitest_1.expect)(() => schemas_1.CleanBookSchema.parse(book)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should default num_reviews to 0', () => {
            const book = {
                upc: '1234567890123',
                title: 'Test',
                price_gbp: 10.0,
                rating: 3,
                category: 'Test',
                available: true,
            };
            const result = schemas_1.CleanBookSchema.parse(book);
            (0, vitest_1.expect)(result.num_reviews).toBe(0);
        });
    });
    (0, vitest_1.describe)('RawHNStorySchema', () => {
        (0, vitest_1.it)('should validate correct raw HN story data', () => {
            const validStory = {
                item_id: 12345678,
                title: 'A new programming language',
                url: 'https://example.com',
                score: 150,
                author: 'johndoe',
                age_text: '2 hours ago',
                comment_count: 45,
            };
            const result = schemas_1.RawHNStorySchema.parse(validStory);
            (0, vitest_1.expect)(result).toEqual(validStory);
        });
        (0, vitest_1.it)('should accept null url', () => {
            const story = {
                item_id: 12345678,
                title: 'Ask HN: Question',
                url: null,
                score: 50,
                author: 'user',
                age_text: '1 hour ago',
                comment_count: 10,
            };
            const result = schemas_1.RawHNStorySchema.parse(story);
            (0, vitest_1.expect)(result.url).toBeNull();
        });
        (0, vitest_1.it)('should default score to 0 if not provided', () => {
            const story = {
                item_id: 12345678,
                title: 'Test',
                author: 'user',
                age_text: '1 hour ago',
                comment_count: 0,
            };
            const result = schemas_1.RawHNStorySchema.parse(story);
            (0, vitest_1.expect)(result.score).toBe(0);
        });
        (0, vitest_1.it)('should default comment_count to 0 if not provided', () => {
            const story = {
                item_id: 12345678,
                title: 'Test',
                author: 'user',
                age_text: '1 hour ago',
                score: 50,
            };
            const result = schemas_1.RawHNStorySchema.parse(story);
            (0, vitest_1.expect)(result.comment_count).toBe(0);
        });
        (0, vitest_1.it)('should reject invalid item_id', () => {
            const story = {
                item_id: -1,
                title: 'Test',
                author: 'user',
                age_text: '1 hour ago',
                score: 50,
                comment_count: 0,
            };
            (0, vitest_1.expect)(() => schemas_1.RawHNStorySchema.parse(story)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject invalid url', () => {
            const story = {
                item_id: 12345678,
                title: 'Test',
                url: 'not-a-valid-url',
                author: 'user',
                age_text: '1 hour ago',
                score: 50,
                comment_count: 0,
            };
            (0, vitest_1.expect)(() => schemas_1.RawHNStorySchema.parse(story)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should reject negative score', () => {
            const story = {
                item_id: 12345678,
                title: 'Test',
                author: 'user',
                age_text: '1 hour ago',
                score: -10,
                comment_count: 0,
            };
            (0, vitest_1.expect)(() => schemas_1.RawHNStorySchema.parse(story)).toThrow(zod_1.z.ZodError);
        });
    });
    (0, vitest_1.describe)('CleanHNStorySchema', () => {
        (0, vitest_1.it)('should validate correct clean HN story data', () => {
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
            const result = schemas_1.CleanHNStorySchema.parse(validStory);
            (0, vitest_1.expect)(result).toEqual(validStory);
        });
        (0, vitest_1.it)('should accept all story types', () => {
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
                const result = schemas_1.CleanHNStorySchema.parse(story);
                (0, vitest_1.expect)(result.story_type).toBe(story_type);
            });
        });
        (0, vitest_1.it)('should reject invalid story_type', () => {
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
            (0, vitest_1.expect)(() => schemas_1.CleanHNStorySchema.parse(story)).toThrow(zod_1.z.ZodError);
        });
    });
    (0, vitest_1.describe)('StoryTypeEnum', () => {
        (0, vitest_1.it)('should accept valid story types', () => {
            const validTypes = ['story', 'ask', 'show', 'job'];
            validTypes.forEach((type) => {
                const result = schemas_1.StoryTypeEnum.parse(type);
                (0, vitest_1.expect)(result).toBe(type);
            });
        });
        (0, vitest_1.it)('should reject invalid story types', () => {
            const invalidTypes = ['invalid', 'post', 'article', ''];
            invalidTypes.forEach((type) => {
                (0, vitest_1.expect)(() => schemas_1.StoryTypeEnum.parse(type)).toThrow(zod_1.z.ZodError);
            });
        });
    });
});
//# sourceMappingURL=schemas.test.js.map