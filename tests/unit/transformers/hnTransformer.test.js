"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const hnTransformer_1 = require("@/transformer/hnTransformer");
const zod_1 = require("zod");
(0, vitest_1.describe)('hnTransformer', () => {
    (0, vitest_1.describe)('transformHNStory', () => {
        (0, vitest_1.it)('should transform valid raw HN story', () => {
            const rawStory = {
                item_id: 12345678,
                title: '  A new programming language  ',
                url: '  https://example.com  ',
                score: 150,
                author: '  johndoe  ',
                age_text: '  2 hours ago  ',
                comment_count: 45,
            };
            const result = (0, hnTransformer_1.transformHNStory)(rawStory);
            (0, vitest_1.expect)(result).toEqual({
                hn_item_id: 12345678,
                title: 'A new programming language',
                url: 'https://example.com',
                score: 150,
                author: 'johndoe',
                age_text: '2 hours ago',
                comment_count: 45,
                story_type: 'story',
            });
        });
        (0, vitest_1.it)('should handle null URL for self-posts', () => {
            const rawStory = {
                item_id: 12345678,
                title: 'Self post without URL',
                url: null,
                score: 50,
                author: 'user',
                age_text: '1 hour ago',
                comment_count: 10,
            };
            const result = (0, hnTransformer_1.transformHNStory)(rawStory);
            (0, vitest_1.expect)(result.url).toBeNull();
        });
        (0, vitest_1.it)('should detect "Ask HN" story type', () => {
            const testCases = [
                'Ask HN: How do I learn programming?',
                'ask hn: What is the best framework?',
                'ASK HN: Career advice needed',
                'Question about Ask HN topics',
            ];
            testCases.forEach((title) => {
                const rawStory = {
                    item_id: 12345678,
                    title,
                    url: null,
                    score: 50,
                    author: 'user',
                    age_text: '1 hour ago',
                    comment_count: 10,
                };
                const result = (0, hnTransformer_1.transformHNStory)(rawStory);
                (0, vitest_1.expect)(result.story_type).toBe('ask');
            });
        });
        (0, vitest_1.it)('should detect "Show HN" story type', () => {
            const testCases = [
                'Show HN: My new project',
                'show hn: A cool tool I built',
                'SHOW HN: Check out this app',
                'Something about Show HN demo',
            ];
            testCases.forEach((title) => {
                const rawStory = {
                    item_id: 12345678,
                    title,
                    url: 'https://example.com',
                    score: 100,
                    author: 'user',
                    age_text: '3 hours ago',
                    comment_count: 25,
                };
                const result = (0, hnTransformer_1.transformHNStory)(rawStory);
                (0, vitest_1.expect)(result.story_type).toBe('show');
            });
        });
        (0, vitest_1.it)('should detect "Job" story type', () => {
            const testCases = [
                'Company XYZ [Hiring] Senior Engineer',
                'Looking for developers (Hiring)',
                'Hiring: Full Stack Developer',
                // Note: "Ask HN: Who is hiring?" is detected as 'ask' (higher priority)
            ];
            testCases.forEach((title) => {
                const rawStory = {
                    item_id: 12345678,
                    title,
                    url: 'https://example.com/jobs',
                    score: 20,
                    author: 'recruiter',
                    age_text: '5 hours ago',
                    comment_count: 100,
                };
                const result = (0, hnTransformer_1.transformHNStory)(rawStory);
                (0, vitest_1.expect)(result.story_type).toBe('job');
            });
        });
        (0, vitest_1.it)('should default to "story" type for regular stories', () => {
            const testCases = [
                'New JavaScript framework released',
                'The future of web development',
                'Understanding quantum computing',
            ];
            testCases.forEach((title) => {
                const rawStory = {
                    item_id: 12345678,
                    title,
                    url: 'https://example.com',
                    score: 75,
                    author: 'user',
                    age_text: '4 hours ago',
                    comment_count: 30,
                };
                const result = (0, hnTransformer_1.transformHNStory)(rawStory);
                (0, vitest_1.expect)(result.story_type).toBe('story');
            });
        });
        (0, vitest_1.it)('should prioritize "Ask HN" over other keywords', () => {
            const rawStory = {
                item_id: 12345678,
                title: 'Ask HN: Who is hiring? [Hiring]',
                url: null,
                score: 50,
                author: 'user',
                age_text: '1 hour ago',
                comment_count: 200,
            };
            const result = (0, hnTransformer_1.transformHNStory)(rawStory);
            (0, vitest_1.expect)(result.story_type).toBe('ask');
        });
        (0, vitest_1.it)('should prioritize "Show HN" over job keywords', () => {
            const rawStory = {
                item_id: 12345678,
                title: 'Show HN: Job board for developers [Hiring]',
                url: 'https://example.com',
                score: 80,
                author: 'user',
                age_text: '2 hours ago',
                comment_count: 15,
            };
            const result = (0, hnTransformer_1.transformHNStory)(rawStory);
            (0, vitest_1.expect)(result.story_type).toBe('show');
        });
        (0, vitest_1.it)('should handle zero scores and comments', () => {
            const rawStory = {
                item_id: 12345678,
                title: 'New story',
                url: 'https://example.com',
                score: 0,
                author: 'newuser',
                age_text: 'just now',
                comment_count: 0,
            };
            const result = (0, hnTransformer_1.transformHNStory)(rawStory);
            (0, vitest_1.expect)(result.score).toBe(0);
            (0, vitest_1.expect)(result.comment_count).toBe(0);
        });
        (0, vitest_1.it)('should throw ZodError for missing required fields', () => {
            const rawStory = {
                item_id: 12345678,
                title: 'Test',
                // Missing author (required field without default)
                score: 50,
                age_text: '1 hour ago',
                comment_count: 5,
            };
            (0, vitest_1.expect)(() => (0, hnTransformer_1.transformHNStory)(rawStory)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should throw ZodError for invalid item_id', () => {
            const rawStory = {
                item_id: 'not-a-number',
                title: 'Test',
                url: 'https://example.com',
                score: 50,
                author: 'user',
                age_text: '1 hour ago',
                comment_count: 5,
            };
            (0, vitest_1.expect)(() => (0, hnTransformer_1.transformHNStory)(rawStory)).toThrow(zod_1.z.ZodError);
        });
        (0, vitest_1.it)('should throw ZodError for negative score', () => {
            const rawStory = {
                item_id: 12345678,
                title: 'Test',
                url: 'https://example.com',
                score: -10,
                author: 'user',
                age_text: '1 hour ago',
                comment_count: 5,
            };
            (0, vitest_1.expect)(() => (0, hnTransformer_1.transformHNStory)(rawStory)).toThrow(zod_1.z.ZodError);
        });
    });
    (0, vitest_1.describe)('transformHNStories', () => {
        (0, vitest_1.it)('should transform array of valid stories', () => {
            const rawStories = [
                {
                    item_id: 11111111,
                    title: 'Story 1',
                    url: 'https://example.com/1',
                    score: 100,
                    author: 'user1',
                    age_text: '1 hour ago',
                    comment_count: 25,
                },
                {
                    item_id: 22222222,
                    title: 'Ask HN: Story 2',
                    url: null,
                    score: 50,
                    author: 'user2',
                    age_text: '2 hours ago',
                    comment_count: 10,
                },
                {
                    item_id: 33333333,
                    title: 'Show HN: Story 3',
                    url: 'https://example.com/3',
                    score: 200,
                    author: 'user3',
                    age_text: '3 hours ago',
                    comment_count: 50,
                },
            ];
            const result = (0, hnTransformer_1.transformHNStories)(rawStories);
            (0, vitest_1.expect)(result).toHaveLength(3);
            (0, vitest_1.expect)(result[0].hn_item_id).toBe(11111111);
            (0, vitest_1.expect)(result[0].story_type).toBe('story');
            (0, vitest_1.expect)(result[1].hn_item_id).toBe(22222222);
            (0, vitest_1.expect)(result[1].story_type).toBe('ask');
            (0, vitest_1.expect)(result[2].hn_item_id).toBe(33333333);
            (0, vitest_1.expect)(result[2].story_type).toBe('show');
        });
        (0, vitest_1.it)('should skip invalid stories but continue processing', () => {
            const rawStories = [
                {
                    item_id: 11111111,
                    title: 'Valid Story 1',
                    url: 'https://example.com/1',
                    score: 100,
                    author: 'user1',
                    age_text: '1 hour ago',
                    comment_count: 25,
                },
                {
                    // Invalid: missing author (required field)
                    item_id: 22222222,
                    title: 'Invalid Story',
                    url: 'https://example.com/2',
                    score: 50,
                    age_text: '2 hours ago',
                    comment_count: 10,
                },
                {
                    item_id: 33333333,
                    title: 'Valid Story 2',
                    url: 'https://example.com/3',
                    score: 150,
                    author: 'user3',
                    age_text: '3 hours ago',
                    comment_count: 30,
                },
            ];
            const result = (0, hnTransformer_1.transformHNStories)(rawStories);
            (0, vitest_1.expect)(result).toHaveLength(2);
            (0, vitest_1.expect)(result[0].hn_item_id).toBe(11111111);
            (0, vitest_1.expect)(result[1].hn_item_id).toBe(33333333);
        });
        (0, vitest_1.it)('should throw error when all stories fail validation', () => {
            const rawStories = [{ invalid: 'data' }, { also: 'invalid' }];
            (0, vitest_1.expect)(() => (0, hnTransformer_1.transformHNStories)(rawStories)).toThrow('All 2 stories failed transformation');
        });
        (0, vitest_1.it)('should return empty array for empty input', () => {
            const result = (0, hnTransformer_1.transformHNStories)([]);
            (0, vitest_1.expect)(result).toEqual([]);
        });
        (0, vitest_1.it)('should handle mixed story types correctly', () => {
            const rawStories = [
                {
                    item_id: 1,
                    title: 'Regular story',
                    url: 'https://example.com',
                    score: 50,
                    author: 'user1',
                    age_text: '1h ago',
                    comment_count: 5,
                },
                {
                    item_id: 2,
                    title: 'Ask HN: Question',
                    url: null,
                    score: 30,
                    author: 'user2',
                    age_text: '2h ago',
                    comment_count: 20,
                },
                {
                    item_id: 3,
                    title: 'Show HN: Project',
                    url: 'https://project.com',
                    score: 100,
                    author: 'user3',
                    age_text: '3h ago',
                    comment_count: 15,
                },
                {
                    item_id: 4,
                    title: 'Company [Hiring]',
                    url: 'https://jobs.com',
                    score: 10,
                    author: 'recruiter',
                    age_text: '4h ago',
                    comment_count: 50,
                },
            ];
            const result = (0, hnTransformer_1.transformHNStories)(rawStories);
            (0, vitest_1.expect)(result).toHaveLength(4);
            (0, vitest_1.expect)(result.map((s) => s.story_type)).toEqual([
                'story',
                'ask',
                'show',
                'job',
            ]);
        });
    });
});
//# sourceMappingURL=hnTransformer.test.js.map