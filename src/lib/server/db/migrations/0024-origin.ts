import { sql, type Kysely } from 'kysely';

// A Term's Origin: an ordered list of links (kind, language, word), a note and one Source.
const triggers = [
	['origin_link_inserted_version', 'insert on origin_link', '(select language_id from term where id = new.term_id)'],
	['origin_link_updated_version', 'update on origin_link', '(select language_id from term where id = new.term_id)'],
	['origin_link_deleted_version', 'delete on origin_link', '(select language_id from term where id = old.term_id)']
] as const;

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('origin_link')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('term_id', 'integer', (col) => col.notNull().references('term.id').onDelete('cascade'))
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('kind', 'text', (col) =>
			col.notNull().check(sql`kind in ('loanword', 'inherited', 'derived', 'calque', 'cognate')`)
		)
		.addColumn('language', 'text', (col) => col.notNull())
		.addColumn('word', 'text', (col) => col.notNull().defaultTo(''))
		.addUniqueConstraint('origin_link_term_position', ['term_id', 'position'])
		.execute();
	await db.schema.alterTable('term').addColumn('origin_note', 'text').execute();
	await db.schema
		.alterTable('term')
		.addColumn('origin_source', 'text', (col) => col.check(sql`origin_source in ('you', 'wiktionary', 'tutor')`))
		.execute();
	// Like Translations, a change to the links moves the Terms version on (0019).
	for (const [name, event, language] of triggers) {
		await sql`
			create trigger ${sql.raw(name)} after ${sql.raw(event)} begin
				update language set terms_version = terms_version + 1 where id = ${sql.raw(language)};
			end
		`.execute(db);
	}
}

export async function down(db: Kysely<any>): Promise<void> {
	for (const [name] of triggers) await sql`drop trigger ${sql.raw(name)}`.execute(db);
	await db.schema.alterTable('term').dropColumn('origin_source').execute();
	await db.schema.alterTable('term').dropColumn('origin_note').execute();
	await db.schema.dropTable('origin_link').execute();
}
