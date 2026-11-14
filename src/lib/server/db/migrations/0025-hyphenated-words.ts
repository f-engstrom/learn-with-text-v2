import type { Kysely } from 'kysely';
import { countWords, normalise, parserFor } from '../../domain/parsing';

/**
 * Words joined by a hyphen are now one Word (почему-то, anak-anak), so each Book's Words and each
 * Page's count of them are worked out again. Sentences keep their text; Terms are untouched.
 */
export async function up(db: Kysely<any>): Promise<void> {
	const books: { id: number; code: string; character_map: string }[] = await db
		.selectFrom('book')
		.innerJoin('language', 'language.id', 'book.language_id')
		.select(['book.id', 'language.code', 'language.character_map'])
		.execute();
	for (const book of books) {
		const language = { code: book.code, characterMap: JSON.parse(book.character_map) };
		const parser = parserFor(language);
		const pages: { id: number; text: string }[] = await db.selectFrom('page').select(['id', 'text']).where('book_id', '=', book.id).execute();
		const words = new Set<string>();
		for (const page of pages) {
			const paragraphs = parser.parse(page.text);
			await db.updateTable('page').set({ words: countWords(paragraphs) }).where('id', '=', page.id).execute();
			for (const token of paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens))) {
				if (token.isWord) words.add(normalise(token.text, language));
			}
		}
		await db.deleteFrom('book_word').where('book_id', '=', book.id).execute();
		if (words.size > 0) {
			await db
				.insertInto('book_word')
				.values([...words].map((normalised) => ({ book_id: book.id, normalised })))
				.execute();
		}
	}
}

/** The old split can't be brought back from here; the Words stay as they are. */
export async function down(): Promise<void> {}
