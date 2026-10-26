import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('book')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('language_id', 'integer', (col) => col.notNull().references('language.id'))
		.addColumn('title', 'text', (col) => col.notNull())
		.addColumn('created_at', 'text', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('page')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('book_id', 'integer', (col) => col.notNull().references('book.id').onDelete('cascade'))
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('text', 'text', (col) => col.notNull())
		.addUniqueConstraint('page_book_position', ['book_id', 'position'])
		.execute();

	await db.schema
		.createTable('sentence')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('page_id', 'integer', (col) => col.notNull().references('page.id').onDelete('cascade'))
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('text', 'text', (col) => col.notNull())
		.addUniqueConstraint('sentence_page_position', ['page_id', 'position'])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('sentence').execute();
	await db.schema.dropTable('page').execute();
	await db.schema.dropTable('book').execute();
}
