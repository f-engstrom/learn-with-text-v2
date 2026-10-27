import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// A Language's frequency list by Normalised form; filled from resources/frequency on first use.
	await db.schema
		.createTable('frequency')
		.addColumn('language_id', 'integer', (col) => col.notNull().references('language.id'))
		.addColumn('normalised', 'text', (col) => col.notNull())
		.addColumn('rank', 'integer', (col) => col.notNull())
		.addPrimaryKeyConstraint('frequency_pk', ['language_id', 'normalised'])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('frequency').execute();
}
