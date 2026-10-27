import type { Kysely } from 'kysely';
import { normalise, parserFor } from '../../domain/parsing';

/** Each Book's distinct Words by Normalised form, so its Unknown share is one query. */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('book_word')
		.addColumn('book_id', 'integer', (col) => col.notNull().references('book.id').onDelete('cascade'))
		.addColumn('normalised', 'text', (col) => col.notNull())
		.addPrimaryKeyConstraint('book_word_pk', ['book_id', 'normalised'])
		.execute();

	// Fill it in for the Books that already exist.
	const books: { id: number; code: string; character_map: string }[] = await db
		.selectFrom('book')
		.innerJoin('language', 'language.id', 'book.language_id')
		.select(['book.id', 'language.code', 'language.character_map'])
		.execute();
	for (const book of books) {
		const language = { code: book.code, characterMap: JSON.parse(book.character_map) };
		const pages: { text: string }[] = await db.selectFrom('page').select('text').where('book_id', '=', book.id).execute();
		const words = new Set(
			pages.flatMap((p) =>
				parserFor(language)
					.parse(p.text)
					.flatMap((para) => para.sentences.flatMap((s) => s.tokens.filter((t) => t.isWord).map((t) => normalise(t.text, language))))
			)
		);
		if (words.size > 0) {
			await db
				.insertInto('book_word')
				.values([...words].map((normalised) => ({ book_id: book.id, normalised })))
				.execute();
		}
	}
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('book_word').execute();
}
