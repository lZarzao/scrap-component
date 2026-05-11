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
const initApp = async (): Promise<Application> => {
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

  // Import routers
  const jobsRouter = (await import('./api/routes/jobs')).default;
  const booksRouter = (await import('./api/routes/books')).default;
  const storiesRouter = (await import('./api/routes/stories')).default;
  const metricsRouter = (await import('./api/routes/metrics')).default;
  const healthRouter = (await import('./api/routes/health')).default;
  const { errorHandler } = await import('./api/middleware/errorHandler');

  // Register routes
  expressApp.use('/api/v1/jobs', jobsRouter);
  expressApp.use('/api/v1/books', booksRouter);
  expressApp.use('/api/v1/stories', storiesRouter);
  expressApp.use('/api/v1/metrics', metricsRouter);
  expressApp.use('/api/v1/health', healthRouter);

  // 404 handler
  expressApp.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // Error handler (must be last!)
  expressApp.use(errorHandler);

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
    app = await initApp();

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
