import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// One graded recall of a Term. Kept as history; the schedule below is what Due reads.
	await db.schema
		.createTable('review')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('term_id', 'integer', (col) => col.notNull().references('term.id').onDelete('cascade'))
		.addColumn('grade', 'text', (col) => col.notNull())
		.addColumn('source', 'text', (col) => col.notNull())
		.addColumn('reviewed_at', 'text', (col) => col.notNull())
		.execute();
	await db.schema.createIndex('review_term').on('review').column('term_id').execute();

	// A Term's FSRS card. A Term that Follows Parent has none: it uses its Parent's.
	await db.schema
		.createTable('schedule')
		.addColumn('term_id', 'integer', (col) => col.primaryKey().references('term.id').onDelete('cascade'))
		.addColumn('due', 'text', (col) => col.notNull())
		.addColumn('stability', 'real', (col) => col.notNull())
		.addColumn('difficulty', 'real', (col) => col.notNull())
		.addColumn('state', 'integer', (col) => col.notNull())
		.addColumn('reps', 'integer', (col) => col.notNull())
		.addColumn('lapses', 'integer', (col) => col.notNull())
		.addColumn('scheduled_days', 'integer', (col) => col.notNull())
		.addColumn('learning_steps', 'integer', (col) => col.notNull())
		.addColumn('last_review', 'text')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('schedule').execute();
	await db.schema.dropTable('review').execute();
}
