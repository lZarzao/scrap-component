import express, { Application } from 'express';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger, pinoLogger } from './logger';
import { initDatabase, closeDatabase } from './db/client';
import { initQueues, closeQueues } from './queue/queues';

/**
 * Application state
 */
let app: Application | null = null;
let server: ReturnType<Application['listen']> | null = null;
let isShuttingDown = false;

/**
 * Initialize Express application
 */
const initApp = (): Application => {
  const expressApp = express();

  // Middleware
  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));

  // HTTP request logging
  expressApp.use(
    pinoHttp({
      logger: pinoLogger,
      autoLogging: true,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 400 && res.statusCode < 500) {
          return 'warn';
        } else if (res.statusCode >= 500 || err) {
          return 'error';
        }
        return 'info';
      },
    })
  );

  // Health check endpoint
  expressApp.get('/api/v1/health', async (_req, res) => {
    if (isShuttingDown) {
      return res.status(503).json({
        status: 'shutting_down',
        message: 'Server is shutting down',
      });
    }

    try {
      // Check database connection
      const { getDatabase } = await import('./db/client');
      const db = getDatabase();
      await db.raw('SELECT 1');

      // Check Redis connection
      const { createRedisClient } = await import('./queue/queues');
      const redis = createRedisClient();
      await redis.ping();
      await redis.quit();

      return res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
      });
    } catch (error) {
      logger.error('Health check failed', error as Error, { module: 'health' });
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Service dependencies are not available',
      });
    }
  });

  // Placeholder route for metrics
  expressApp.get('/api/v1/metrics', async (_req, res) => {
    try {
      const { getQueueMetrics } = await import('./queue/queues');
      const metrics = await getQueueMetrics();

      res.json({
        timestamp: new Date().toISOString(),
        queues: metrics,
        process: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
      });
    } catch (error) {
      logger.error('Failed to get metrics', error as Error, { module: 'metrics' });
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });

  // Manual job trigger endpoint
  expressApp.post('/api/v1/jobs/trigger', async (req, res) => {
    try {
      const { source } = req.body;

      if (!source || (source !== 'books' && source !== 'hackernews')) {
        return res.status(400).json({
          error: 'Invalid source',
          message: 'Source must be either "books" or "hackernews"',
        });
      }

      const { triggerBooksScrape, triggerHNScrape } = await import('./scheduler/jobFactory');

      let jobId: string;
      if (source === 'books') {
        jobId = await triggerBooksScrape();
      } else {
        jobId = await triggerHNScrape();
      }

      return res.json({
        success: true,
        jobId,
        source,
        message: 'Scrape job triggered successfully',
      });
    } catch (error) {
      logger.error('Failed to trigger job', error as Error, { module: 'api' });
      return res.status(500).json({
        error: 'Failed to trigger job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // DLQ endpoints
  expressApp.get('/api/v1/jobs/dlq', async (_req, res) => {
    try {
      const { getDLQJobs } = await import('./queue/dlq');
      const jobs = await getDLQJobs();

      return res.json({
        count: jobs.length,
        jobs: jobs.map((job) => ({
          id: job.id,
          data: job.data,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
        })),
      });
    } catch (error) {
      logger.error('Failed to get DLQ jobs', error as Error, { module: 'api' });
      return res.status(500).json({
        error: 'Failed to get DLQ jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  expressApp.get('/api/v1/jobs/dlq/stats', async (_req, res) => {
    try {
      const { getDLQStats } = await import('./queue/dlq');
      const stats = await getDLQStats();

      return res.json(stats);
    } catch (error) {
      logger.error('Failed to get DLQ stats', error as Error, { module: 'api' });
      return res.status(500).json({
        error: 'Failed to get DLQ stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  expressApp.post('/api/v1/jobs/dlq/:jobId/retry', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { retryDLQJob } = await import('./queue/dlq');
      const success = await retryDLQJob(jobId);

      if (!success) {
        return res.status(404).json({
          error: 'Job not found',
          message: `DLQ job ${jobId} not found`,
        });
      }

      return res.json({
        success: true,
        message: 'Job retried successfully',
      });
    } catch (error) {
      logger.error('Failed to retry DLQ job', error as Error, { module: 'api' });
      return res.status(500).json({
        error: 'Failed to retry DLQ job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  expressApp.delete('/api/v1/jobs/dlq/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { removeDLQJob } = await import('./queue/dlq');
      const success = await removeDLQJob(jobId);

      if (!success) {
        return res.status(404).json({
          error: 'Job not found',
          message: `DLQ job ${jobId} not found`,
        });
      }

      return res.json({
        success: true,
        message: 'Job removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove DLQ job', error as Error, { module: 'api' });
      return res.status(500).json({
        error: 'Failed to remove DLQ job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // 404 handler
  expressApp.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // Error handler
  expressApp.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Unhandled error', err, { module: 'express' });
      res.status(500).json({
        error: 'Internal Server Error',
        message: config.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      });
    }
  );

  return expressApp;
};

/**
 * Start the application
 */
const start = async (): Promise<void> => {
  try {
    logger.info('🚀 Starting DataHarvest Pipeline Service...', { module: 'startup' });

    // Initialize database
    logger.info('Initializing database...', { module: 'startup' });
    await initDatabase();

    // Initialize queues
    logger.info('Initializing queue system...', { module: 'startup' });
    await initQueues();

    // Initialize scraper worker
    logger.info('Initializing scraper worker...', { module: 'startup' });
    const { initScraperWorker } = await import('./workers/scraperWorker');
    initScraperWorker();

    // Initialize transformer worker
    logger.info('Initializing transformer worker...', { module: 'startup' });
    const { createTransformerWorker } = await import('./transformer/transformerWorker');
    createTransformerWorker();

    // Initialize persister worker
    logger.info('Initializing persister worker...', { module: 'startup' });
    const { createPersisterWorker } = await import('./persister/persisterWorker');
    createPersisterWorker();

    // Initialize scheduler
    logger.info('Initializing scheduler...', { module: 'startup' });
    const { initScheduler } = await import('./scheduler');
    initScheduler();

    // Initialize Express app
    logger.info('Initializing HTTP server...', { module: 'startup' });
    app = initApp();

    // Start server
    server = app.listen(config.PORT, () => {
      logger.info(`✅ Server running on port ${config.PORT}`, {
        module: 'startup',
        port: config.PORT,
        environment: config.NODE_ENV,
        nodeVersion: process.version,
      });
    });

    // Setup graceful shutdown handlers
    setupGracefulShutdown();
  } catch (error) {
    logger.fatal('Failed to start application', error as Error, { module: 'startup' });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress', { module: 'shutdown' });
    return;
  }

  isShuttingDown = true;
  logger.info(`🛑 Received ${signal}, starting graceful shutdown...`, { module: 'shutdown' });

  // Set shutdown timeout
  const shutdownTimer = setTimeout(() => {
    const timeoutError = new Error('Graceful shutdown timeout exceeded, forcing exit');
    logger.error('Graceful shutdown timeout exceeded, forcing exit', timeoutError, {
      module: 'shutdown',
    });
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);

  try {
    // Stop accepting new connections
    if (server) {
      logger.info('Closing HTTP server...', { module: 'shutdown' });
      await new Promise<void>((resolve, reject) => {
        server!.close((err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed', { module: 'shutdown' });
    }

    // Stop scheduler
    logger.info('Stopping scheduler...', { module: 'shutdown' });
    const { stopScheduler } = await import('./scheduler');
    stopScheduler();

    // Close scraper worker
    logger.info('Closing scraper worker...', { module: 'shutdown' });
    const { closeScraperWorker } = await import('./workers/scraperWorker');
    await closeScraperWorker();

    // Close transformer worker
    logger.info('Closing transformer worker...', { module: 'shutdown' });
    const { closeTransformerWorker } = await import('./transformer/transformerWorker');
    await closeTransformerWorker();

    // Close persister worker
    logger.info('Closing persister worker...', { module: 'shutdown' });
    const { closePersisterWorker } = await import('./persister/persisterWorker');
    await closePersisterWorker();

    // Close queue system (wait for in-flight jobs)
    logger.info('Closing queue system...', { module: 'shutdown' });
    await closeQueues();

    // Close database connections
    logger.info('Closing database connections...', { module: 'shutdown' });
    await closeDatabase();

    clearTimeout(shutdownTimer);
    logger.info('✅ Graceful shutdown complete', { module: 'shutdown' });
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimer);
    logger.fatal('Error during shutdown', error as Error, { module: 'shutdown' });
    process.exit(1);
  }
};

/**
 * Setup graceful shutdown handlers
 */
const setupGracefulShutdown = (): void => {
  // Handle SIGTERM (Docker, Kubernetes)
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', reason as Error, {
      module: 'uncaught',
      promise: String(promise),
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught Exception', error, { module: 'uncaught' });
    shutdown('UNCAUGHT_EXCEPTION');
  });
};

// Start the application
start();
