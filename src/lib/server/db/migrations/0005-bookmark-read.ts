import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('book')
		.addColumn('bookmark_page', 'integer', (col) => col.notNull().defaultTo(1))
		.execute();
	await db.schema
		.alterTable('book')
		.addColumn('bookmark_sentence', 'integer', (col) => col.notNull().defaultTo(1))
		.execute();
	await db.schema.alterTable('page').addColumn('read_at', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('page').dropColumn('read_at').execute();
	await db.schema.alterTable('book').dropColumn('bookmark_sentence').execute();
	await db.schema.alterTable('book').dropColumn('bookmark_page').execute();
}
