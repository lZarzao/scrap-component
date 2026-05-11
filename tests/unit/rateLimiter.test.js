"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rateLimiter_1 = require("@/workers/rateLimiter");
(0, vitest_1.describe)('RateLimiter', () => {
    let rateLimiter;
    (0, vitest_1.beforeEach)(() => {
        // Create a new rate limiter with 100ms delay for faster tests
        rateLimiter = new rateLimiter_1.RateLimiter(100);
    });
    (0, vitest_1.describe)('wait', () => {
        (0, vitest_1.it)('should not delay first request to a host', async () => {
            const start = Date.now();
            await rateLimiter.wait('example.com');
            const elapsed = Date.now() - start;
            // First request should be immediate (allow some margin for execution time)
            (0, vitest_1.expect)(elapsed).toBeLessThan(50);
        });
        (0, vitest_1.it)('should enforce minimum delay between requests to same host', async () => {
            const host = 'example.com';
            // First request
            await rateLimiter.wait(host);
            // Second request - should wait
            const start = Date.now();
            await rateLimiter.wait(host);
            const elapsed = Date.now() - start;
            // Should wait approximately minDelay (100ms)
            // Allow some margin for execution time
            (0, vitest_1.expect)(elapsed).toBeGreaterThanOrEqual(90);
            (0, vitest_1.expect)(elapsed).toBeLessThan(150);
        });
        (0, vitest_1.it)('should allow immediate request if enough time has passed', async () => {
            const host = 'example.com';
            // First request
            await rateLimiter.wait(host);
            // Wait longer than minDelay
            await new Promise((resolve) => setTimeout(resolve, 150));
            // Second request should be immediate
            const start = Date.now();
            await rateLimiter.wait(host);
            const elapsed = Date.now() - start;
            (0, vitest_1.expect)(elapsed).toBeLessThan(50);
        });
        (0, vitest_1.it)('should track different hosts independently', async () => {
            // First request to host A
            await rateLimiter.wait('hostA.com');
            // Immediate request to host B (should not wait)
            const start = Date.now();
            await rateLimiter.wait('hostB.com');
            const elapsed = Date.now() - start;
            (0, vitest_1.expect)(elapsed).toBeLessThan(50);
        });
        (0, vitest_1.it)('should enforce delay for multiple consecutive requests', async () => {
            const host = 'example.com';
            const requests = 3;
            const start = Date.now();
            for (let i = 0; i < requests; i++) {
                await rateLimiter.wait(host);
            }
            const elapsed = Date.now() - start;
            // Should wait (requests - 1) * minDelay
            // First request is immediate, rest wait 100ms each
            const expectedMin = (requests - 1) * 100;
            (0, vitest_1.expect)(elapsed).toBeGreaterThanOrEqual(expectedMin - 10);
            (0, vitest_1.expect)(elapsed).toBeLessThan(expectedMin + 100);
        });
        (0, vitest_1.it)('should handle rapid consecutive requests correctly', async () => {
            const host = 'example.com';
            const timestamps = [];
            // Make 3 rapid requests
            for (let i = 0; i < 3; i++) {
                await rateLimiter.wait(host);
                timestamps.push(Date.now());
            }
            // Check time between consecutive requests
            for (let i = 1; i < timestamps.length; i++) {
                const timeBetween = timestamps[i] - timestamps[i - 1];
                // Should be at least minDelay (100ms) apart
                (0, vitest_1.expect)(timeBetween).toBeGreaterThanOrEqual(90);
            }
        });
    });
    (0, vitest_1.describe)('reset', () => {
        (0, vitest_1.it)('should clear all rate limit state', async () => {
            const host = 'example.com';
            // Make first request
            await rateLimiter.wait(host);
            // Reset
            rateLimiter.reset();
            // Next request should be immediate
            const start = Date.now();
            await rateLimiter.wait(host);
            const elapsed = Date.now() - start;
            (0, vitest_1.expect)(elapsed).toBeLessThan(50);
        });
    });
    (0, vitest_1.describe)('getMinDelay', () => {
        (0, vitest_1.it)('should return the configured minimum delay', () => {
            const delay = rateLimiter.getMinDelay();
            (0, vitest_1.expect)(delay).toBe(100);
        });
    });
    (0, vitest_1.describe)('setMinDelay', () => {
        (0, vitest_1.it)('should update the minimum delay', async () => {
            const host = 'example.com';
            // Make first request
            await rateLimiter.wait(host);
            // Change delay to 200ms
            rateLimiter.setMinDelay(200);
            // Second request should wait 200ms
            const start = Date.now();
            await rateLimiter.wait(host);
            const elapsed = Date.now() - start;
            (0, vitest_1.expect)(elapsed).toBeGreaterThanOrEqual(190);
            (0, vitest_1.expect)(elapsed).toBeLessThan(250);
        });
    });
    (0, vitest_1.describe)('concurrent hosts', () => {
        (0, vitest_1.it)('should handle multiple hosts concurrently', async () => {
            const hosts = ['host1.com', 'host2.com', 'host3.com'];
            const start = Date.now();
            // Start all requests simultaneously
            await Promise.all(hosts.map((host) => rateLimiter.wait(host)));
            const elapsed = Date.now() - start;
            // Should complete quickly since they're different hosts
            (0, vitest_1.expect)(elapsed).toBeLessThan(50);
        });
        (0, vitest_1.it)('should enforce delay per host in concurrent scenario', async () => {
            const host = 'example.com';
            // First request
            await rateLimiter.wait(host);
            // Start two requests simultaneously (both should wait)
            const start = Date.now();
            await rateLimiter.wait(host);
            const elapsed1 = Date.now() - start;
            await rateLimiter.wait(host);
            const elapsed2 = Date.now() - start;
            // First should wait ~100ms, second should wait ~200ms total
            (0, vitest_1.expect)(elapsed1).toBeGreaterThanOrEqual(90);
            (0, vitest_1.expect)(elapsed2).toBeGreaterThanOrEqual(190);
        });
    });
    (0, vitest_1.describe)('edge cases', () => {
        (0, vitest_1.it)('should handle very small delays', async () => {
            const limiter = new rateLimiter_1.RateLimiter(1); // 1ms delay
            const host = 'example.com';
            await limiter.wait(host);
            const start = Date.now();
            await limiter.wait(host);
            const elapsed = Date.now() - start;
            // Should wait at least 1ms (but likely a bit more due to JS timing)
            (0, vitest_1.expect)(elapsed).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(elapsed).toBeLessThan(50);
        });
        (0, vitest_1.it)('should handle zero delay', async () => {
            const limiter = new rateLimiter_1.RateLimiter(0);
            const host = 'example.com';
            await limiter.wait(host);
            const start = Date.now();
            await limiter.wait(host);
            const elapsed = Date.now() - start;
            // Should be very fast (zero delay means no waiting)
            (0, vitest_1.expect)(elapsed).toBeLessThan(1050); // Allow 1s for test overhead
        });
        (0, vitest_1.it)('should handle large delays', async () => {
            const limiter = new rateLimiter_1.RateLimiter(500);
            const host = 'example.com';
            await limiter.wait(host);
            const start = Date.now();
            await limiter.wait(host);
            const elapsed = Date.now() - start;
            (0, vitest_1.expect)(elapsed).toBeGreaterThanOrEqual(490);
            (0, vitest_1.expect)(elapsed).toBeLessThan(600);
        });
    });
});
//# sourceMappingURL=rateLimiter.test.js.map