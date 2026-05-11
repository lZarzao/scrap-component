import basicAuth from 'express-basic-auth';
import { Request } from 'express';
import { config } from '../../config';
import { logger } from '../../logger';

/**
 * HTTP Basic Authentication middleware for Bull Board dashboard
 *
 * This middleware protects the Bull Board dashboard with username/password authentication.
 * When accessing the dashboard, the browser will show a native login popup.
 *
 * Credentials are configured via environment variables:
 * - BULL_BOARD_USERNAME (default: "admin")
 * - BULL_BOARD_PASSWORD (must be set in .env)
 *
 * Security notes:
 * - Always use HTTPS in production (Basic Auth sends credentials in Base64)
 * - Use a strong, random password in production
 * - Consider IP whitelisting for additional security
 * - Rotate credentials regularly
 *
 * Example usage:
 * ```typescript
 * app.use('/admin/queues', bullBoardAuth, bullBoardRouter);
 * ```
 */
export const bullBoardAuth = basicAuth({
  // Users object with dynamic username from config
  users: {
    [config.BULL_BOARD_USERNAME]: config.BULL_BOARD_PASSWORD,
  },

  // Send WWW-Authenticate header to trigger browser login popup
  challenge: true,

  // Realm name shown in the browser login dialog
  realm: 'BullMQ Dashboard - DataHarvest',

  // Custom unauthorized response
  unauthorizedResponse: (req: Request) => {
    logger.warn('Unauthorized access attempt to Bull Board dashboard', {
      module: 'auth',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return {
      error: 'Unauthorized',
      message: 'Invalid credentials for Bull Board dashboard',
    };
  },

  // Custom authorizer to log successful logins (optional)
  authorizer: (username: string, password: string) => {
    const validUsername = username === config.BULL_BOARD_USERNAME;
    const validPassword = password === config.BULL_BOARD_PASSWORD;
    const isValid = validUsername && validPassword;

    if (isValid) {
      logger.info('Successful Bull Board login', {
        module: 'auth',
        username,
      });
    }

    return isValid;
  },
});

/**
 * Validate that Bull Board credentials are configured
 * This should be called at startup to ensure the dashboard is secure
 */
export const validateBullBoardCredentials = (): void => {
  if (!config.BULL_BOARD_PASSWORD || config.BULL_BOARD_PASSWORD === '') {
    const error = new Error(
      'BULL_BOARD_PASSWORD must be set when Bull Board is enabled. ' +
        'Please set it in your .env file.'
    );
    logger.error('BULL_BOARD_PASSWORD is not set in environment variables!', error, {
      module: 'auth',
    });
    throw error;
  }

  if (config.BULL_BOARD_PASSWORD === 'change_me_in_production_please') {
    logger.warn('Bull Board is using default password! Change it in production.', {
      module: 'auth',
    });
  }

  logger.info('Bull Board credentials validated', {
    module: 'auth',
    username: config.BULL_BOARD_USERNAME,
  });
};
