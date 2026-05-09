import { Knex } from 'knex';

/**
 * Create scrape_jobs table
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('scrape_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('source', 50).notNullable().index();
    table
      .enum('status', ['pending', 'processing', 'completed', 'failed'], {
        useNative: true,
        enumName: 'job_status',
      })
      .notNullable()
      .defaultTo('pending')
      .index();
    table.timestamp('triggered_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.text('error_message').nullable();
    table.jsonb('metadata').nullable();

    // Indexes for common queries
    table.index(['status', 'triggered_at']);
    table.index(['source', 'triggered_at']);
  });

  // Add comment
  await knex.raw(
    `COMMENT ON TABLE scrape_jobs IS 'Tracks all scraping jobs and their execution status'`
  );
}

/**
 * Drop scrape_jobs table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scrape_jobs');
  await knex.raw('DROP TYPE IF EXISTS job_status');
}
