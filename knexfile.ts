import type { Knex } from 'knex';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      user: process.env.DB_USER || 'dataharvest_user',
      password: process.env.DB_PASSWORD || 'dataharvest_pass',
      database: process.env.DB_NAME || 'dataharvest',
    },
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations'),
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5433', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations'),
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    pool: {
      min: 2,
      max: 20,
    },
  },
};

export default config;
module.exports = config;
