import { sql, type Kysely } from 'kysely';
import { countWords, parserFor } from '../../domain/parsing';

/** SQLite's clock in the same ISO format as `new Date().toISOString()`. */
const now = sql.raw(`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);

export async function up(db: Kysely<any>): Promise<void> {
	// Each Page's Words, so Words read is a sum.
	await db.schema.alterTable('page').addColumn('words', 'integer', (col) => col.notNull().defaultTo(0)).execute();
	const pages = await db
		.selectFrom('page')
		.innerJoin('book', 'book.id', 'page.book_id')
		.innerJoin('language', 'language.id', 'book.language_id')
		.select(['page.id', 'page.text', 'language.code'])
		.execute();
	for (const page of pages) {
		const words = countWords(parserFor({ code: page.code }).parse(page.text));
		await db.updateTable('page').set({ words }).where('id', '=', page.id).execute();
	}

	// The Status history (ADR 0005): a null from_status is a new Term, a null to_status a deleted one.
	await db.schema
		.createTable('status_change')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('term_id', 'integer', (col) => col.notNull())
		.addColumn('language_id', 'integer', (col) => col.notNull())
		.addColumn('from_status', 'text')
		.addColumn('to_status', 'text')
		.addColumn('changed_at', 'text', (col) => col.notNull())
		.execute();
	await db.schema.createIndex('status_change_language').on('status_change').columns(['language_id', 'changed_at']).execute();

	// Terms saved before the history began count from the day they were saved, at their present Status.
	await sql`
		insert into status_change (term_id, language_id, from_status, to_status, changed_at)
		select id, language_id, null, status, created_at from term order by created_at, id
	`.execute(db);

	await sql`
		create trigger term_saved after insert on term begin
			insert into status_change (term_id, language_id, from_status, to_status, changed_at)
			values (new.id, new.language_id, null, new.status, ${now});
		end
	`.execute(db);
	await sql`
		create trigger term_status_changed after update of status on term when old.status is not new.status begin
			insert into status_change (term_id, language_id, from_status, to_status, changed_at)
			values (new.id, new.language_id, old.status, new.status, ${now});
		end
	`.execute(db);
	await sql`
		create trigger term_deleted after delete on term begin
			insert into status_change (term_id, language_id, from_status, to_status, changed_at)
			values (old.id, old.language_id, old.status, null, ${now});
		end
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	for (const trigger of ['term_deleted', 'term_status_changed', 'term_saved']) {
		await sql`drop trigger ${sql.raw(trigger)}`.execute(db);
	}
	await db.schema.dropTable('status_change').execute();
	await db.schema.alterTable('page').dropColumn('words').execute();
}
