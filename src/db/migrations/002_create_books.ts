import { Knex } from 'knex';

/**
 * Create books table
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('books', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('upc', 50).notNullable().unique();
    table.string('title', 500).notNullable();
    table.decimal('price_gbp', 10, 2).notNullable();
    table.integer('rating').notNullable().checkBetween([1, 5]);
    table.string('category', 100).notNullable().index();
    table.boolean('available').notNullable().defaultTo(true);
    table.text('description').nullable();
    table.integer('num_reviews').notNullable().defaultTo(0);
    table.timestamp('scraped_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['category', 'rating']);
    table.index('scraped_at');
  });

  // Add comment
  await knex.raw(`COMMENT ON TABLE books IS 'Scraped books data from books.toscrape.com'`);

  // Create trigger for updated_at
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  await knex.raw(`
    CREATE TRIGGER update_books_updated_at 
    BEFORE UPDATE ON books 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

/**
 * Drop books table
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('books');
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
}
