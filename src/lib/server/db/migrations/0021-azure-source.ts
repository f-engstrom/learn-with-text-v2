import { sql, type Kysely } from 'kysely';

const triggers = [
	['translation_inserted_version', 'insert on translation', '(select language_id from term where id = new.term_id)'],
	['translation_updated_version', 'update on translation', '(select language_id from term where id = new.term_id)'],
	['translation_deleted_version', 'delete on translation', '(select language_id from term where id = old.term_id)']
] as const;

/** Rebuilds the translation table to allow `sources`: SQLite can't change a check constraint in place. */
async function rebuild(db: Kysely<any>, sources: string[], copiedSource: string): Promise<void> {
	await db.schema
		.createTable('translation_new')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('term_id', 'integer', (col) => col.notNull().references('term.id').onDelete('cascade'))
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('text', 'text', (col) => col.notNull())
		.addColumn('source', 'text', (col) => col.notNull().check(sql`source in (${sql.join(sources.map((s) => sql.lit(s)))})`))
		.addUniqueConstraint('translation_term_position', ['term_id', 'position'])
		.execute();
	await sql`insert into translation_new (id, term_id, position, text, source)
		select id, term_id, position, text, ${sql.raw(copiedSource)} from translation`.execute(db);
	// Dropping the table drops its triggers too; they're made again on the new one.
	await db.schema.dropTable('translation').execute();
	await db.schema.alterTable('translation_new').renameTo('translation').execute();
	for (const [name, event, language] of triggers) {
		await sql`
			create trigger ${sql.raw(name)} after ${sql.raw(event)} begin
				update language set terms_version = terms_version + 1 where id = ${sql.raw(language)};
			end
		`.execute(db);
	}
}

export async function up(db: Kysely<any>): Promise<void> {
	await rebuild(db, ['you', 'wiktionary', 'tutor', 'azure'], 'source');
}

export async function down(db: Kysely<any>): Promise<void> {
	// Translations picked from Azure become yours.
	await rebuild(db, ['you', 'wiktionary', 'tutor'], `case source when 'azure' then 'you' else source end`);
}
