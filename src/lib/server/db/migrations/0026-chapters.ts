import type { Kysely } from 'kysely';

/**
 * A Chapter is a mark on the Page that starts it: the Chapter's title, empty when it has none.
 * A Page with null starts no Chapter; a Chapter runs to the next mark (ADR 0009).
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('page').addColumn('chapter', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('page').dropColumn('chapter').execute();
}
