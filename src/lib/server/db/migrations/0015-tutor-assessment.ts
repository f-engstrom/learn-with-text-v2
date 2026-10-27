import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// The Tutor's assessment, on the Status scale (Learning 1–4 or Known); null until it has asked.
	await db.schema.alterTable('term').addColumn('tutor_level', 'text').execute();
	// Transfer from Your languages: form and concept, each easy, medium or hard, with an optional reason.
	await db.schema.alterTable('term').addColumn('transfer_form', 'text').execute();
	await db.schema.alterTable('term').addColumn('transfer_concept', 'text').execute();
	await db.schema.alterTable('term').addColumn('transfer_reason', 'text').execute();

	await db.schema
		.createTable('your_language')
		.addColumn('name', 'text', (col) => col.primaryKey())
		.addColumn('level', 'text', (col) => col.notNull())
		.addColumn('added_at', 'text', (col) => col.notNull())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('your_language').execute();
	for (const column of ['transfer_reason', 'transfer_concept', 'transfer_form', 'tutor_level']) {
		await db.schema.alterTable('term').dropColumn(column).execute();
	}
}
