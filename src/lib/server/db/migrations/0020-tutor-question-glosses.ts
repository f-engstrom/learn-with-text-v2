import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// JSON: the Glosses shown with a Tutor's question, each a Word or phrase and its short meaning.
	await db.schema.alterTable('tutor_question').addColumn('glosses', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('tutor_question').dropColumn('glosses').execute();
}
