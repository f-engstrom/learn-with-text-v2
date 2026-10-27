import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { getPage, type Bookmark } from './books';
import { suggestPronunciation } from './pronunciation';

export class InvalidBookmark extends Error {}

export async function getBookmark(db: Kysely<Database>, bookId: number): Promise<Bookmark | undefined> {
	const row = await db
		.selectFrom('book')
		.select(['bookmark_page', 'bookmark_sentence'])
		.where('id', '=', bookId)
		.executeTakeFirst();
	return row && { page: row.bookmark_page, sentence: row.bookmark_sentence };
}

/** Moves the Bookmark. A Sentence past the end of the Page is clamped to its last Sentence. */
export async function setBookmark(db: Kysely<Database>, bookId: number, bookmark: Bookmark): Promise<Bookmark> {
	const page = await db
		.selectFrom('page')
		.select((eb) =>
			eb.selectFrom('sentence').whereRef('sentence.page_id', '=', 'page.id').select(eb.fn.countAll<number>().as('n')).as('sentences')
		)
		.where('book_id', '=', bookId)
		.where('position', '=', bookmark.page)
		.executeTakeFirst();
	if (!page) throw new InvalidBookmark('No such Page.');
	const saved = { page: bookmark.page, sentence: Math.min(Math.max(1, Math.trunc(bookmark.sentence) || 1), Number(page.sentences)) };
	await db
		.updateTable('book')
		.set({ bookmark_page: saved.page, bookmark_sentence: saved.sentence })
		.where('id', '=', bookId)
		.execute();
	return saved;
}

export interface MarkRead {
	/** Also make every Unknown Word on the Page Known. */
	restKnown?: boolean;
}

/**
 * Marks a Page Read and moves the Bookmark to the start of the next Page, if there is one.
 * Returns the next Page's position, or undefined on the last Page.
 */
export async function markPageRead(
	db: Kysely<Database>,
	bookId: number,
	position: number,
	{ restKnown = false }: MarkRead = {}
): Promise<number | undefined> {
	const page = await getPage(db, bookId, position);
	if (!page) throw new InvalidBookmark('No such Page.');
	const { language } = page;
	const next = position < page.book.pageCount ? position + 1 : undefined;

	// Unknown Words by Normalised form, keeping the first occurrence's text.
	const unknown = new Map<string, string>();
	if (restKnown) {
		for (const token of page.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens))) {
			if (token.key !== undefined && !page.terms[token.key] && !unknown.has(token.key)) {
				unknown.set(token.key, token.text.toLocaleLowerCase(language.code));
			}
		}
	}

	await db.transaction().execute(async (trx) => {
		const now = new Date().toISOString();
		if (unknown.size > 0) {
			await trx
				.insertInto('term')
				.values(
					[...unknown].map(([normalised, text]) => ({
						language_id: language.id,
						text,
						normalised,
						status: 'known' as const,
						pronunciation: suggestPronunciation(text, language),
						created_at: now
					}))
				)
				// A Term saved meanwhile (e.g. by the Tutor) keeps its Status.
				.onConflict((oc) => oc.columns(['language_id', 'normalised']).doNothing())
				.execute();
		}
		await trx.updateTable('page').set({ read_at: now }).where('book_id', '=', bookId).where('position', '=', position).execute();
		if (next !== undefined) {
			await trx.updateTable('book').set({ bookmark_page: next, bookmark_sentence: 1 }).where('id', '=', bookId).execute();
		}
	});
	return next;
}
