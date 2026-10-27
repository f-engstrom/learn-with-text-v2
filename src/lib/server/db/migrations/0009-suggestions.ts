import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// Subjects you like reading about, in English, shared by every Language.
	await db.schema
		.createTable('topic')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('text', 'text', (col) => col.notNull().unique().modifyEnd(sql`collate nocase`))
		.execute();

	// The Fit range, per Language, as shares from 0 to 1.
	await db.schema.alterTable('language').addColumn('fit_min', 'real', (col) => col.notNull().defaultTo(0.05)).execute();
	await db.schema.alterTable('language').addColumn('fit_max', 'real', (col) => col.notNull().defaultTo(0.15)).execute();

	// Where a Book from the web came from, so it is never suggested again.
	await db.schema.alterTable('book').addColumn('url', 'text').execute();
	await db.schema.createIndex('book_url').on('book').column('url').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('book_url').execute();
	await db.schema.alterTable('book').dropColumn('url').execute();
	await db.schema.alterTable('language').dropColumn('fit_max').execute();
	await db.schema.alterTable('language').dropColumn('fit_min').execute();
	await db.schema.dropTable('topic').execute();
}
