import type { Kysely } from 'kysely';

// One web address, one Book: the index on a Book's address becomes unique. Books without one are unaffected.

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('book_url').execute();
	await db.schema.createIndex('book_url').unique().on('book').column('url').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('book_url').execute();
	await db.schema.createIndex('book_url').on('book').column('url').execute();
}
