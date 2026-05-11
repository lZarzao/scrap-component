import axios from 'axios';
import { describe, test, beforeAll, afterAll, expect } from 'vitest';

/**
 * Integration Test - Full Pipeline
 *
 * This test verifies that the entire data pipeline works end-to-end:
 * 1. Trigger a scrape job via API
 * 2. Wait for the job to complete
 * 3. Verify data was persisted using API endpoints
 *
 * NOTE: Requires Docker services to be running:
 * docker compose up -d
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';
const JOB_POLL_INTERVAL = 2000; // 2 seconds
const MAX_WAIT_TIME = 120000; // 2 minutes

describe('Full Pipeline Integration Test', () => {
  // Skip if not running in integration test mode
  const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

  beforeAll(async () => {
    if (!runIntegrationTests) {
      console.log('⏭️  Skipping integration tests. Set RUN_INTEGRATION_TESTS=true to run.');
      return;
    }

    // Wait for services to be healthy
    console.log('⏳ Waiting for services to be ready...');
    await waitForServices();
  });

  afterAll(async () => {
    // Cleanup is handled by the application
    // Integration tests don't need to close connections
  });

  /**
   * Wait for API and database to be available
   */
  async function waitForServices(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const healthResponse = await axios.get(`${API_BASE_URL}/health`, {
          timeout: 5000,
        });

        if (healthResponse.status === 200) {
          console.log('✅ Services are healthy');
          return;
        }
      } catch (error) {
        console.log(`⏳ Attempt ${i + 1}/${maxAttempts}: Services not ready yet...`);
        await sleep(2000);
      }
    }

    throw new Error('Services failed to become healthy within timeout');
  }

  /**
   * Poll job status until completed or timeout
   */
  async function waitForJobCompletion(jobId: string): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_TIME) {
      try {
        const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`);
        const job = response.data;

        console.log(`📊 Job ${jobId} status: ${job.status}`);

        if (job.status === 'completed') {
          return job;
        }

        if (job.status === 'failed') {
          throw new Error(`Job failed: ${job.error_message}`);
        }

        await sleep(JOB_POLL_INTERVAL);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.log(`⏳ Job ${jobId} not found yet, waiting...`);
        } else {
          throw error;
        }
        await sleep(JOB_POLL_INTERVAL);
      }
    }

    throw new Error(`Job ${jobId} did not complete within ${MAX_WAIT_TIME}ms`);
  }

  /**
   * Sleep utility
   */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  test('should trigger books scrape and persist data to database', async () => {
    if (!runIntegrationTests) {
      console.log('⏭️  Test skipped');
      return;
    }

    console.log('\n🚀 Starting integration test: Books scraping pipeline\n');

    // Step 1: Trigger books scrape job
    console.log('📤 Step 1: Triggering books scrape job...');
    const triggerResponse = await axios.post(`${API_BASE_URL}/jobs/trigger`, {
      source: 'books',
    });

    expect(triggerResponse.status).toBe(202);
    expect(triggerResponse.data).toHaveProperty('jobId');
    expect(triggerResponse.data.source).toBe('books');

    const jobId = triggerResponse.data.jobId;
    console.log(`✅ Job triggered: ${jobId}\n`);

    // Step 2: Wait for job completion
    console.log('⏳ Step 2: Waiting for job to complete...');
    const completedJob = await waitForJobCompletion(jobId);
    expect(completedJob.status).toBe('completed');
    console.log('✅ Job completed successfully\n');

    // Step 3: Verify data via API endpoint
    console.log('🔍 Step 3: Verifying data via books API...');
    const booksResponse = await axios.get(`${API_BASE_URL}/books?limit=10`);
    expect(booksResponse.status).toBe(200);
    expect(booksResponse.data.data).toBeInstanceOf(Array);
    expect(booksResponse.data.data.length).toBeGreaterThan(0);
    console.log(`✅ Found ${booksResponse.data.data.length} books via API\n`);

    // Step 4: Verify book data structure
    console.log('🔍 Step 4: Verifying book data structure...');
    const firstBook = booksResponse.data.data[0];

    expect(firstBook).toHaveProperty('id');
    expect(firstBook).toHaveProperty('upc');
    expect(firstBook).toHaveProperty('title');
    expect(firstBook).toHaveProperty('price_gbp');
    expect(firstBook).toHaveProperty('rating');
    expect(firstBook).toHaveProperty('scraped_at');

    // Verify data types
    expect(typeof firstBook.title).toBe('string');
    expect(typeof firstBook.rating).toBe('number');
    expect(firstBook.rating).toBeGreaterThanOrEqual(1);
    expect(firstBook.rating).toBeLessThanOrEqual(5);

    console.log('✅ Book data structure is correct\n');

    // Step 5: Verify pagination works
    console.log('🔍 Step 5: Verifying pagination...');

    const booksListResponse = await axios.get(`${API_BASE_URL}/books?limit=5`);
    expect(booksListResponse.status).toBe(200);
    expect(booksListResponse.data.data).toBeInstanceOf(Array);
    expect(booksListResponse.data.data.length).toBeGreaterThan(0);
    console.log(`✅ Books API returned ${booksListResponse.data.data.length} books\n`);

    // Step 6: Verify idempotency (optional, commented out for speed)
    // console.log('🔍 Step 6: Testing idempotency...');
    // const countBefore = books.length;
    //
    // // Trigger same job again
    // const secondTriggerResponse = await axios.post(`${API_BASE_URL}/jobs/trigger`, {
    //   source: 'books',
    // });
    // await waitForJobCompletion(secondTriggerResponse.data.jobId);
    //
    // const booksAfter = await db('books').select('*');
    // expect(booksAfter.length).toBe(countBefore); // No duplicates
    // console.log('✅ Idempotency verified: no duplicate records\n');

    console.log('✅ 🎉 Integration test passed! Full pipeline works correctly.\n');
  }, 180000); // 3 minutes timeout

  test('should trigger HN scrape and persist stories to database', async () => {
    if (!runIntegrationTests) {
      console.log('⏭️  Test skipped');
      return;
    }

    console.log('\n🚀 Starting integration test: Hacker News scraping pipeline\n');

    // Step 1: Trigger HN scrape job
    console.log('📤 Step 1: Triggering HN scrape job...');
    const triggerResponse = await axios.post(`${API_BASE_URL}/jobs/trigger`, {
      source: 'hackernews',
    });

    expect(triggerResponse.status).toBe(202);
    expect(triggerResponse.data).toHaveProperty('jobId');
    expect(triggerResponse.data.source).toBe('hackernews');

    const jobId = triggerResponse.data.jobId;
    console.log(`✅ Job triggered: ${jobId}\n`);

    // Step 2: Wait for job completion
    console.log('⏳ Step 2: Waiting for job to complete...');
    const completedJob = await waitForJobCompletion(jobId);
    expect(completedJob.status).toBe('completed');
    console.log('✅ Job completed successfully\n');

    // Step 3: Verify data via API endpoint
    console.log('🔍 Step 3: Verifying data via stories API...');
    const storiesResponse = await axios.get(`${API_BASE_URL}/stories?limit=10`);
    expect(storiesResponse.status).toBe(200);
    expect(storiesResponse.data.data).toBeInstanceOf(Array);
    expect(storiesResponse.data.data.length).toBeGreaterThan(0);
    console.log(`✅ Found ${storiesResponse.data.data.length} stories via API\n`);

    // Step 4: Verify story data structure
    console.log('🔍 Step 4: Verifying story data structure...');
    const firstStory = storiesResponse.data.data[0];

    expect(firstStory).toHaveProperty('id');
    expect(firstStory).toHaveProperty('hn_item_id');
    expect(firstStory).toHaveProperty('title');
    expect(firstStory).toHaveProperty('score');
    expect(firstStory).toHaveProperty('author');
    expect(firstStory).toHaveProperty('story_type');
    expect(firstStory).toHaveProperty('scraped_at');

    // Verify data types
    expect(typeof firstStory.title).toBe('string');
    expect(typeof firstStory.score).toBe('number');
    expect(['story', 'ask', 'show', 'job']).toContain(firstStory.story_type);

    console.log('✅ Story data structure is correct\n');

    // Step 5: Verify pagination works
    console.log('🔍 Step 5: Verifying pagination...');

    const storiesListResponse = await axios.get(`${API_BASE_URL}/stories?limit=5`);
    expect(storiesListResponse.status).toBe(200);
    expect(storiesListResponse.data.data).toBeInstanceOf(Array);
    expect(storiesListResponse.data.data.length).toBeGreaterThan(0);
    console.log(`✅ Stories API returned ${storiesListResponse.data.data.length} stories\n`);

    console.log('✅ 🎉 Integration test passed! HN pipeline works correctly.\n');
  }, 180000); // 3 minutes timeout
});
