import { config } from '../config';
import { logger } from '../logger';

/**
 * Rate limiter using token bucket algorithm
 * Ensures minimum delay between requests to the same host
 */
class RateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private minDelayMs: number;

  constructor(minDelayMs?: number) {
    this.minDelayMs = minDelayMs || config.MIN_REQUEST_DELAY_MS;
    logger.debug('Rate limiter initialized', {
      module: 'rateLimiter',
      minDelayMs: this.minDelayMs,
    });
  }

  /**
   * Wait if necessary to respect rate limit for a given host
   * @param host - The host to rate limit (e.g., 'books.toscrape.com')
   */
  async wait(host: string): Promise<void> {
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(host);

    if (lastRequest) {
      const timeSinceLastRequest = now - lastRequest;
      const waitTime = this.minDelayMs - timeSinceLastRequest;

      if (waitTime > 0) {
        logger.debug('Rate limiting: waiting', {
          module: 'rateLimiter',
          host,
          waitTimeMs: waitTime,
        });
        await this.sleep(waitTime);
      }
    }

    // Update last request time
    this.lastRequestTime.set(host, Date.now());
  }

  /**
   * Sleep for a given duration
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset rate limiter state (useful for testing)
   */
  reset(): void {
    this.lastRequestTime.clear();
    logger.debug('Rate limiter reset', { module: 'rateLimiter' });
  }

  /**
   * Get the minimum delay in milliseconds
   */
  getMinDelay(): number {
    return this.minDelayMs;
  }

  /**
   * Set a new minimum delay
   * @param ms - New minimum delay in milliseconds
   */
  setMinDelay(ms: number): void {
    this.minDelayMs = ms;
    logger.debug('Rate limiter delay updated', {
      module: 'rateLimiter',
      minDelayMs: ms,
    });
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Export class for testing
export { RateLimiter };
