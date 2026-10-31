import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// The Tutor's question in the reading screen: at most one per Book, replaced by the next.
	await db.schema
		.createTable('tutor_question')
		.addColumn('book_id', 'integer', (col) => col.primaryKey().references('book.id').onDelete('cascade'))
		.addColumn('feedback', 'text')
		// The questions and the answer as JSON.
		.addColumn('questions', 'text', (col) => col.notNull())
		.addColumn('asked_at', 'text', (col) => col.notNull())
		.addColumn('answer', 'text')
		.addColumn('answered_at', 'text')
		.addColumn('dismissed_at', 'text')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('tutor_question').execute();
}
