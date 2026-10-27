import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// The Tutor's Highlight: a run of Sentences on one Page, with an optional note. One per Book.
	await db.schema.alterTable('book').addColumn('highlight_page', 'integer').execute();
	await db.schema.alterTable('book').addColumn('highlight_first', 'integer').execute();
	await db.schema.alterTable('book').addColumn('highlight_last', 'integer').execute();
	await db.schema.alterTable('book').addColumn('highlight_note', 'text').execute();
	// When it was set, so an open reading screen can tell a new Highlight from the one it has.
	await db.schema.alterTable('book').addColumn('highlighted_at', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	for (const column of ['highlighted_at', 'highlight_note', 'highlight_last', 'highlight_first', 'highlight_page']) {
		await db.schema.alterTable('book').dropColumn(column).execute();
	}
}
