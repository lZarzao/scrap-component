import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';

/**
 * OpenAPI 3.1 specification configuration
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'DataHarvest Pipeline Service API',
      version: '1.0.0',
      description: `
A production-grade web scraping and data pipeline system that orchestrates scraping workers, 
manages job queues with retry and failure handling, transforms raw scraped data, and stores 
clean records in a database.

**Key Features:**
- ✅ Layer-Based Event-Driven Architecture
- ✅ Queue Management with BullMQ
- ✅ Retry Policies & Dead Letter Queue
- ✅ Graceful Shutdown
- ✅ Structured Logging
- ✅ Health Checks & Metrics

**Tech Stack:**
- Node.js 20 LTS
- TypeScript (strict mode)
- Express.js
- BullMQ + Redis
- PostgreSQL + Knex.js
- Zod validation
- Pino logger
      `,
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'DataHarvest Inc.',
        url: 'https://github.com/your-repo',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: 'Development server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Default local server',
      },
    ],
    tags: [
      {
        name: 'Jobs',
        description: 'Scrape job management and DLQ operations',
      },
      {
        name: 'Books',
        description: 'Query scraped books data from books.toscrape.com',
      },
      {
        name: 'Stories',
        description: 'Query scraped Hacker News stories',
      },
      {
        name: 'Metrics',
        description: 'System metrics and queue statistics',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
    components: {
      schemas: {
        // Common schemas
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
          required: ['error'],
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of items',
            },
            page: {
              type: 'integer',
              description: 'Current page number',
            },
            limit: {
              type: 'integer',
              description: 'Items per page',
            },
            pages: {
              type: 'integer',
              description: 'Total number of pages',
            },
          },
        },
        // Job schemas
        ScrapeJob: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique job identifier',
            },
            source: {
              type: 'string',
              enum: ['books', 'hackernews'],
              description: 'Data source',
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              description: 'Current job status',
            },
            triggered_at: {
              type: 'string',
              format: 'date-time',
              description: 'Job creation timestamp',
            },
            started_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Job start timestamp',
            },
            completed_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Job completion timestamp',
            },
            error_message: {
              type: 'string',
              nullable: true,
              description: 'Error message if failed',
            },
            metadata: {
              type: 'object',
              nullable: true,
              description: 'Additional job metadata',
            },
          },
        },
        TriggerJobRequest: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              enum: ['books', 'hackernews'],
              description: 'Source to scrape',
              example: 'books',
            },
          },
          required: ['source'],
        },
        TriggerJobResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Scrape job triggered successfully',
            },
            jobId: {
              type: 'string',
              format: 'uuid',
              description: 'Created job ID',
            },
            source: {
              type: 'string',
              enum: ['books', 'hackernews'],
            },
            status: {
              type: 'string',
              example: 'pending',
            },
          },
        },
        // Book schemas
        Book: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            upc: {
              type: 'string',
              description: 'Universal Product Code (unique)',
              example: 'a897fe39b1053632',
            },
            title: {
              type: 'string',
              description: 'Book title',
              example: 'A Light in the Attic',
            },
            price_gbp: {
              type: 'number',
              format: 'decimal',
              description: 'Price in GBP',
              example: 51.77,
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Star rating (1-5)',
              example: 3,
            },
            category: {
              type: 'string',
              description: 'Book category',
              example: 'Poetry',
            },
            available: {
              type: 'boolean',
              description: 'Availability status',
              example: true,
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Book description',
            },
            num_reviews: {
              type: 'integer',
              description: 'Number of reviews',
              example: 0,
            },
            scraped_at: {
              type: 'string',
              format: 'date-time',
              description: 'Scrape timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        // Story schemas
        Story: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            hn_item_id: {
              type: 'integer',
              format: 'int64',
              description: 'Hacker News item ID (unique)',
              example: 48091116,
            },
            title: {
              type: 'string',
              description: 'Story title',
              example: 'Show HN: My Cool Project',
            },
            url: {
              type: 'string',
              nullable: true,
              description: 'Story URL (null for self-posts)',
              example: 'https://example.com',
            },
            score: {
              type: 'integer',
              description: 'Story score/points',
              example: 42,
            },
            author: {
              type: 'string',
              description: 'Author username',
              example: 'pg',
            },
            age_text: {
              type: 'string',
              description: 'Human-readable age',
              example: '2 hours ago',
            },
            comment_count: {
              type: 'integer',
              description: 'Number of comments',
              example: 15,
            },
            story_type: {
              type: 'string',
              enum: ['story', 'ask', 'show', 'job'],
              description: 'Story type',
              example: 'show',
            },
            scraped_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // Metrics schema
        Metrics: {
          type: 'object',
          properties: {
            queues: {
              type: 'object',
              properties: {
                'scrape-pending': {
                  $ref: '#/components/schemas/QueueMetrics',
                },
                'scrape-raw': {
                  $ref: '#/components/schemas/QueueMetrics',
                },
                'scrape-processed': {
                  $ref: '#/components/schemas/QueueMetrics',
                },
                'scrape-dlq': {
                  $ref: '#/components/schemas/QueueMetrics',
                },
              },
            },
            sources: {
              type: 'object',
              properties: {
                books: {
                  $ref: '#/components/schemas/SourceMetrics',
                },
                hackernews: {
                  $ref: '#/components/schemas/SourceMetrics',
                },
              },
            },
            process: {
              $ref: '#/components/schemas/ProcessMetrics',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        QueueMetrics: {
          type: 'object',
          properties: {
            waiting: {
              type: 'integer',
            },
            active: {
              type: 'integer',
            },
            completed: {
              type: 'integer',
            },
            failed: {
              type: 'integer',
            },
            delayed: {
              type: 'integer',
            },
          },
        },
        SourceMetrics: {
          type: 'object',
          properties: {
            totalRecords: {
              type: 'integer',
            },
            lastSuccessfulRun: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            lastFailedRun: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
        ProcessMetrics: {
          type: 'object',
          properties: {
            uptime: {
              type: 'number',
              description: 'Process uptime in seconds',
            },
            memory: {
              type: 'object',
              properties: {
                rss: {
                  type: 'number',
                },
                heapTotal: {
                  type: 'number',
                },
                heapUsed: {
                  type: 'number',
                },
                external: {
                  type: 'number',
                },
              },
            },
            cpu: {
              type: 'object',
              properties: {
                user: {
                  type: 'number',
                },
                system: {
                  type: 'number',
                },
              },
            },
          },
        },
        // Health schema
        Health: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              example: 'healthy',
            },
            checks: {
              type: 'object',
              properties: {
                database: {
                  type: 'boolean',
                  description: 'PostgreSQL connectivity',
                },
                redis: {
                  type: 'boolean',
                  description: 'Redis connectivity',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
                uptime: {
                  type: 'number',
                  description: 'Process uptime in seconds',
                },
                environment: {
                  type: 'string',
                  example: 'development',
                },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/v1/jobs/trigger': {
        post: {
          tags: ['Jobs'],
          summary: 'Manually trigger a scrape job',
          description: 'Triggers a new scrape job for the specified source (books or hackernews)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TriggerJobRequest',
                },
              },
            },
          },
          responses: {
            '202': {
              description: 'Job triggered successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/TriggerJobResponse',
                  },
                },
              },
            },
            '400': {
              description: 'Invalid request',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/jobs': {
        get: {
          tags: ['Jobs'],
          summary: 'List all scrape jobs',
          description: 'Retrieve a paginated list of scrape jobs with optional filters',
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['pending', 'processing', 'completed', 'failed'],
              },
              description: 'Filter by job status',
            },
            {
              name: 'source',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['books', 'hackernews'],
              },
              description: 'Filter by data source',
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                default: 20,
              },
              description: 'Number of items per page',
            },
            {
              name: 'offset',
              in: 'query',
              schema: {
                type: 'integer',
                default: 0,
              },
              description: 'Number of items to skip',
            },
          ],
          responses: {
            '200': {
              description: 'List of jobs',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/ScrapeJob',
                        },
                      },
                      pagination: {
                        $ref: '#/components/schemas/Pagination',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/jobs/{id}': {
        get: {
          tags: ['Jobs'],
          summary: 'Get single job by ID',
          description: 'Retrieve detailed information about a specific job',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid',
              },
              description: 'Job UUID',
            },
          ],
          responses: {
            '200': {
              description: 'Job details',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ScrapeJob',
                  },
                },
              },
            },
            '404': {
              description: 'Job not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/jobs/dlq': {
        get: {
          tags: ['Jobs'],
          summary: 'Inspect Dead Letter Queue',
          description: 'Retrieve failed jobs from the DLQ (last 50 entries)',
          responses: {
            '200': {
              description: 'DLQ contents',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: {
                        type: 'integer',
                      },
                      jobs: {
                        type: 'array',
                        items: {
                          type: 'object',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/jobs/dlq/{jobId}': {
        delete: {
          tags: ['Jobs'],
          summary: 'Remove job from DLQ',
          description: 'Permanently remove a failed job from the Dead Letter Queue',
          parameters: [
            {
              name: 'jobId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
              description: 'DLQ Job ID',
            },
          ],
          responses: {
            '200': {
              description: 'Job removed successfully',
            },
            '404': {
              description: 'Job not found in DLQ',
            },
          },
        },
      },
      '/api/v1/jobs/dlq/{jobId}/retry': {
        post: {
          tags: ['Jobs'],
          summary: 'Retry failed job',
          description: 'Re-queue a failed job from the DLQ for reprocessing',
          parameters: [
            {
              name: 'jobId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
              description: 'DLQ Job ID',
            },
          ],
          responses: {
            '200': {
              description: 'Job re-queued successfully',
            },
            '404': {
              description: 'Job not found in DLQ',
            },
          },
        },
      },
      '/api/v1/books': {
        get: {
          tags: ['Books'],
          summary: 'List scraped books',
          description: 'Retrieve a paginated list of books with optional filters',
          parameters: [
            {
              name: 'category',
              in: 'query',
              schema: {
                type: 'string',
              },
              description: 'Filter by category (case-insensitive)',
              example: 'Fiction',
            },
            {
              name: 'minRating',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 5,
              },
              description: 'Minimum star rating',
              example: 4,
            },
            {
              name: 'page',
              in: 'query',
              schema: {
                type: 'integer',
                default: 1,
              },
              description: 'Page number',
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                default: 20,
              },
              description: 'Items per page',
            },
          ],
          responses: {
            '200': {
              description: 'List of books',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Book',
                        },
                      },
                      pagination: {
                        $ref: '#/components/schemas/Pagination',
                      },
                      filters: {
                        type: 'object',
                        properties: {
                          category: {
                            type: 'string',
                            nullable: true,
                          },
                          minRating: {
                            type: 'integer',
                            nullable: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/books/{upc}': {
        get: {
          tags: ['Books'],
          summary: 'Get book by UPC',
          description: 'Retrieve a single book by its Universal Product Code',
          parameters: [
            {
              name: 'upc',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
              description: 'Book UPC',
              example: 'a897fe39b1053632',
            },
          ],
          responses: {
            '200': {
              description: 'Book details',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Book',
                  },
                },
              },
            },
            '404': {
              description: 'Book not found',
            },
          },
        },
      },
      '/api/v1/stories': {
        get: {
          tags: ['Stories'],
          summary: 'List Hacker News stories',
          description: 'Retrieve a paginated list of HN stories with optional filters',
          parameters: [
            {
              name: 'type',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['story', 'ask', 'show', 'job'],
              },
              description: 'Filter by story type',
              example: 'show',
            },
            {
              name: 'minScore',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 0,
              },
              description: 'Minimum score/points',
              example: 100,
            },
            {
              name: 'page',
              in: 'query',
              schema: {
                type: 'integer',
                default: 1,
              },
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                default: 20,
              },
            },
          ],
          responses: {
            '200': {
              description: 'List of stories',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Story',
                        },
                      },
                      pagination: {
                        $ref: '#/components/schemas/Pagination',
                      },
                      filters: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            nullable: true,
                          },
                          minScore: {
                            type: 'integer',
                            nullable: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/stories/{hn_item_id}': {
        get: {
          tags: ['Stories'],
          summary: 'Get story by HN item ID',
          description: 'Retrieve a single story by its Hacker News item ID',
          parameters: [
            {
              name: 'hn_item_id',
              in: 'path',
              required: true,
              schema: {
                type: 'integer',
                format: 'int64',
              },
              description: 'Hacker News item ID',
              example: 48091116,
            },
          ],
          responses: {
            '200': {
              description: 'Story details',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Story',
                  },
                },
              },
            },
            '400': {
              description: 'Invalid item ID',
            },
            '404': {
              description: 'Story not found',
            },
          },
        },
      },
      '/api/v1/metrics': {
        get: {
          tags: ['Metrics'],
          summary: 'Get system metrics',
          description:
            'Retrieve comprehensive system metrics including queue depths, throughput, error rates, and process statistics',
          responses: {
            '200': {
              description: 'System metrics',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Metrics',
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description:
            'Check the health status of the application, including database and Redis connectivity',
          responses: {
            '200': {
              description: 'System is healthy',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Health',
                  },
                },
              },
            },
            '503': {
              description: 'System is unhealthy',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Health',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/api/routes/*.ts'], // Path to API routes for JSDoc comments
};

export const swaggerSpec = swaggerJsdoc(options);
