import { Knex } from 'knex';

/**
 * Create hn_stories table
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('hn_stories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.bigInteger('hn_item_id').notNullable().unique();
    table.string('title', 500).notNullable();
    table.string('url', 1000).nullable();
    table.integer('score').notNullable().defaultTo(0).index();
    table.string('author', 100).notNullable();
    table.string('age_text', 50).notNullable();
    table.integer('comment_count').notNullable().defaultTo(0);
    table
      .enum('story_type', ['story', 'ask', 'show', 'job'], {
        useNative: true,
        enumName: 'story_type',
      })
      .notNullable()
      .defaultTo('story')
      .index();
    table.timestamp('scraped_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['story_type', 'score']);
    table.index('scraped_at');
  });

  // Add comment
  await knex.raw(`COMMENT ON TABLE hn_stories IS 'Scraped stories from Hacker News'`);

  // Create trigger for updated_at
  await knex.raw(`
    CREATE TRIGGER update_hn_stories_updated_at 
    BEFORE UPDATE ON hn_stories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

/**
 * Drop hn_stories table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('hn_stories');
  await knex.raw('DROP TYPE IF EXISTS story_type');
}
