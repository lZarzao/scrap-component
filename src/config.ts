import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenvConfig();

/**
 * Environment configuration schema with validation
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server
  PORT: z.string().default('3000').transform(Number),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432').transform(Number),
  DB_USER: z.string().default('dataharvest_user'),
  DB_PASSWORD: z.string().default('dataharvest_pass'),
  DB_NAME: z.string().default('dataharvest'),
  DB_SSL: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  DB_DEBUG: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  // Queue Configuration
  SCRAPER_CONCURRENCY: z.string().default('3').transform(Number),
  TRANSFORMER_CONCURRENCY: z.string().default('5').transform(Number),
  PERSISTER_CONCURRENCY: z.string().default('2').transform(Number),

  // Rate Limiting
  MIN_REQUEST_DELAY_MS: z.string().default('1000').transform(Number),

  // Scheduler
  BOOKS_CRON: z.string().default('0 2 * * *'), // Daily at 02:00 UTC
  HN_CRON: z.string().default('*/15 * * * *'), // Every 15 minutes
  ENABLE_SCHEDULER: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),

  // Scraper Configuration
  BOOKS_MAX_PAGES: z.string().default('5').transform(Number),
  HN_MAX_PAGES: z.string().default('2').transform(Number),
  USER_AGENT: z.string().default('DataHarvestBot/1.0 (tech-assessment)'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Graceful Shutdown
  SHUTDOWN_TIMEOUT_MS: z.string().default('30000').transform(Number),

  // Bull Board Dashboard
  BULL_BOARD_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  BULL_BOARD_PATH: z.string().default('/admin/queues'),
  BULL_BOARD_USERNAME: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().default(''),
});

/**
 * Validated environment configuration
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Load and validate configuration
 */
const loadConfig = (): Config => {
  try {
    const config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment configuration:');
      console.error(JSON.stringify(error.issues, null, 2));
      process.exit(1);
    }
    throw error;
  }
};

export const config = loadConfig();

export const isProduction = (): boolean => config.NODE_ENV === 'production';

export const isDevelopment = (): boolean => config.NODE_ENV === 'development';

export const isTest = (): boolean => config.NODE_ENV === 'test';
