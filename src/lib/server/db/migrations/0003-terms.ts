import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('term')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('language_id', 'integer', (col) => col.notNull().references('language.id'))
		.addColumn('text', 'text', (col) => col.notNull())
		.addColumn('normalised', 'text', (col) => col.notNull())
		.addColumn('status', 'text', (col) =>
			col.notNull().check(sql`status in ('learning1', 'learning2', 'learning3', 'learning4', 'known', 'ignored')`)
		)
		.addColumn('created_at', 'text', (col) => col.notNull())
		.addUniqueConstraint('term_language_normalised', ['language_id', 'normalised'])
		.execute();

	await db.schema
		.createTable('translation')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('term_id', 'integer', (col) => col.notNull().references('term.id').onDelete('cascade'))
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('text', 'text', (col) => col.notNull())
		.addColumn('source', 'text', (col) => col.notNull().check(sql`source in ('you', 'wiktionary', 'tutor')`))
		.addUniqueConstraint('translation_term_position', ['term_id', 'position'])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('translation').execute();
	await db.schema.dropTable('term').execute();
}
