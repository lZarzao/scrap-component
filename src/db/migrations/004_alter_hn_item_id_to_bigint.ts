import { Knex } from 'knex';

/**
 * Alter hn_item_id column from INTEGER to BIGINT
 * This is required by the assessment specification and provides future-proofing
 * for HN item IDs which could theoretically exceed INTEGER range
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE hn_stories 
    ALTER COLUMN hn_item_id TYPE BIGINT
  `);
}

/**
 * Rollback: Alter hn_item_id column back to INTEGER
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE hn_stories 
    ALTER COLUMN hn_item_id TYPE INTEGER
  `);
}
