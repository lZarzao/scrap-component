import knex, { Knex } from 'knex';
import { logger } from '../logger';

let db: Knex | null = null;

/**
 * Initialize database connection
 */
export const initDatabase = async (): Promise<Knex> => {
  if (db) {
    return db;
  }

  const config: Knex.Config = {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'dataharvest_user',
      password: process.env.DB_PASSWORD || 'dataharvest_pass',
      database: process.env.DB_NAME || 'dataharvest',
    },
    pool: {
      min: 2,
      max: 10,
    },
    debug: process.env.DB_DEBUG === 'true',
  };

  db = knex(config);

  try {
    // Test connection
    await db.raw('SELECT 1');
    logger.info('Database connection established', { module: 'database' });
  } catch (error) {
    logger.error('Failed to connect to database', error as Error, { module: 'database' });
    throw error;
  }

  return db;
};

/**
 * Get database instance
 */
export const getDatabase = (): Knex => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database connection closed', { module: 'database' });
  }
};
