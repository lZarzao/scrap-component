import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queues } from '../queue/queues';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Setup Bull Board dashboard for queue monitoring
 *
 * Bull Board provides a web UI to:
 * - Monitor queue status (waiting, active, completed, failed, delayed)
 * - Inspect individual job details and payloads
 * - Retry failed jobs
 * - Clean up old jobs
 * - View real-time statistics
 *
 * @returns ExpressAdapter configured with all queues
 */
export const setupBullBoard = (): ExpressAdapter => {
  logger.info('Setting up Bull Board dashboard...', { module: 'bullboard' });

  // Create Express adapter for Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(config.BULL_BOARD_PATH);

  // Register all queues with Bull Board
  createBullBoard({
    queues: [
      new BullMQAdapter(queues.pending),
      new BullMQAdapter(queues.raw),
      new BullMQAdapter(queues.processed),
      new BullMQAdapter(queues.dlq),
    ],
    serverAdapter,
  });

  logger.info(`Bull Board configured with 4 queues`, {
    module: 'bullboard',
    path: config.BULL_BOARD_PATH,
    queues: ['scrape-pending', 'scrape-raw', 'scrape-processed', 'scrape-dlq'],
  });

  return serverAdapter;
};
