import pino from 'pino';

// Define log levels
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Define log context structure
export interface LogContext {
  module?: string;
  jobId?: string;
  source?: 'books' | 'hackernews';
  [key: string]: unknown;
}

// Determine if we should use pretty printing
// Only in development AND when running locally (not in Docker)
const usePrettyPrint = process.env.NODE_ENV === 'development' && !process.env.DOCKER_ENV;

// Create base logger instance
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  // Pretty print only for local development
  ...(usePrettyPrint
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * Logger wrapper with context support
 */
class Logger {
  private context: LogContext = {};

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  /**
   * Log trace message
   */
  trace(message: string, additionalContext?: LogContext): void {
    baseLogger.trace({ ...this.context, ...additionalContext }, message);
  }

  /**
   * Log debug message
   */
  debug(message: string, additionalContext?: LogContext): void {
    baseLogger.debug({ ...this.context, ...additionalContext }, message);
  }

  /**
   * Log info message
   */
  info(message: string, additionalContext?: LogContext): void {
    baseLogger.info({ ...this.context, ...additionalContext }, message);
  }

  /**
   * Log warning message
   */
  warn(message: string, additionalContext?: LogContext): void {
    baseLogger.warn({ ...this.context, ...additionalContext }, message);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, additionalContext?: LogContext): void {
    baseLogger.error(
      {
        ...this.context,
        ...additionalContext,
        err: error,
      },
      message
    );
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error, additionalContext?: LogContext): void {
    baseLogger.fatal(
      {
        ...this.context,
        ...additionalContext,
        err: error,
      },
      message
    );
  }
}

// Export singleton instance
export const logger = new Logger();

// Export raw pino logger for express-pino-http middleware
export const pinoLogger = baseLogger;
