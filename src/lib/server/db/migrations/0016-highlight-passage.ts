import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// A passage within the Highlight's Sentences, as written; null when it covers them whole.
	await db.schema.alterTable('book').addColumn('highlight_text', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('book').dropColumn('highlight_text').execute();
}
