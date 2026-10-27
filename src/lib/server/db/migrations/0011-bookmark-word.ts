import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// The Word (or phrase) last selected in the Bookmark's Sentence, as written.
	await db.schema.alterTable('book').addColumn('bookmark_word', 'text').execute();
	// When the Bookmark last moved, so "where I am" is the most recently moved one.
	await db.schema.alterTable('book').addColumn('bookmarked_at', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('book').dropColumn('bookmarked_at').execute();
	await db.schema.alterTable('book').dropColumn('bookmark_word').execute();
}
