import { sql, type Kysely } from 'kysely';

const triggers = [
	['term_inserted_version', 'insert on term', 'new.language_id'],
	['term_updated_version', 'update on term', 'new.language_id'],
	['term_deleted_version', 'delete on term', 'old.language_id'],
	['translation_inserted_version', 'insert on translation', '(select language_id from term where id = new.term_id)'],
	['translation_updated_version', 'update on translation', '(select language_id from term where id = new.term_id)'],
	['translation_deleted_version', 'delete on translation', '(select language_id from term where id = old.term_id)'],
	['review_inserted_version', 'insert on review', '(select language_id from term where id = new.term_id)']
] as const;

export async function up(db: Kysely<any>): Promise<void> {
	// Moves on with every change to a Language's Terms, Translations or Reviews, from any process,
	// so an open Page can tell it should reload them.
	await db.schema.alterTable('language').addColumn('terms_version', 'integer', (col) => col.notNull().defaultTo(0)).execute();
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
	await db.schema.alterTable('language').dropColumn('terms_version').execute();
}
