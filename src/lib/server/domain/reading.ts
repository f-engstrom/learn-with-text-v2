import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { getPage, toBookmark, type Bookmark } from './books';
import { suggestPronunciation } from './pronunciation';
import { passageParts } from '../../reading/passage';

export class InvalidBookmark extends Error {}
export class InvalidHighlight extends Error {}

/** A run of Sentences on one Page that the Tutor points you to. Sentences are 1-based and inclusive. */
export interface Highlight {
	page: number;
	first: number;
	last: number;
	/** A passage within those Sentences (e.g. one clause), as written; without it the Sentences are highlighted whole. */
	text?: string;
	note?: string;
	/** When it was set. */
	at: string;
}

/** The longest note a Highlight takes: a sentence or two, not a lesson. */
export const highlightNoteLength = 300;

export async function getBookmark(db: Kysely<Database>, bookId: number): Promise<Bookmark | undefined> {
	const row = await db
		.selectFrom('book')
		.select(['bookmark_page', 'bookmark_sentence', 'bookmark_word'])
		.where('id', '=', bookId)
		.executeTakeFirst();
	return row && toBookmark(row);
}

/** The Book whose Bookmark moved most recently: where you are now. */
export async function latestBookmark(db: Kysely<Database>): Promise<{ bookId: number; title: string; bookmark: Bookmark; at: string } | undefined> {
	const row = await db
		.selectFrom('book')
		.select(['id', 'title', 'bookmark_page', 'bookmark_sentence', 'bookmark_word', 'bookmarked_at'])
		.where('bookmarked_at', 'is not', null)
		.orderBy('bookmarked_at', 'desc')
		.limit(1)
		.executeTakeFirst();
	return row && { bookId: row.id, title: row.title, bookmark: toBookmark(row), at: row.bookmarked_at! };
}

/**
 * Moves the Bookmark. A Sentence past the end of the Page is clamped to its last Sentence.
 * A Word, if given, must be in that Sentence.
 */
export async function setBookmark(db: Kysely<Database>, bookId: number, bookmark: Bookmark): Promise<Bookmark> {
	const page = await db
		.selectFrom('page')
		.select('page.id')
		.select((eb) =>
			eb.selectFrom('sentence').whereRef('sentence.page_id', '=', 'page.id').select(eb.fn.countAll<number>().as('n')).as('sentences')
		)
		.where('book_id', '=', bookId)
		.where('position', '=', bookmark.page)
		.executeTakeFirst();
	if (!page) throw new InvalidBookmark('No such Page.');
	const sentence = Math.min(Math.max(1, Math.trunc(bookmark.sentence) || 1), Number(page.sentences));
	const word = bookmark.word?.trim().replace(/\s+/g, ' ') || undefined;
	if (word !== undefined) {
		const row = await db.selectFrom('sentence').select('text').where('page_id', '=', page.id).where('position', '=', sentence).executeTakeFirst();
		const flat = (text: string) => text.replace(/\s+/g, ' ').normalize('NFC').toLowerCase();
		if (!row || !flat(row.text).includes(flat(word))) throw new InvalidBookmark(`“${word}” isn't in Sentence ${sentence} of Page ${bookmark.page}.`);
	}
	await db
		.updateTable('book')
		.set({ bookmark_page: bookmark.page, bookmark_sentence: sentence, bookmark_word: word ?? null, bookmarked_at: new Date().toISOString() })
		.where('id', '=', bookId)
		.execute();
	return { page: bookmark.page, sentence, ...(word ? { word } : {}) };
}

export async function getHighlight(db: Kysely<Database>, bookId: number): Promise<Highlight | undefined> {
	const row = await db
		.selectFrom('book')
		.select(['highlight_page', 'highlight_first', 'highlight_last', 'highlight_text', 'highlight_note', 'highlighted_at'])
		.where('id', '=', bookId)
		.executeTakeFirst();
	if (!row || row.highlight_page === null || row.highlight_first === null || row.highlight_last === null) return undefined;
	return {
		page: row.highlight_page,
		first: row.highlight_first,
		last: row.highlight_last,
		...(row.highlight_text ? { text: row.highlight_text } : {}),
		...(row.highlight_note ? { note: row.highlight_note } : {}),
		at: row.highlighted_at ?? ''
	};
}

/**
 * Sets the Book's Highlight, replacing any it had. The Sentences must be on the Page, in order, and
 * a passage, if given, must be in them.
 */
export async function setHighlight(
	db: Kysely<Database>,
	bookId: number,
	highlight: Omit<Highlight, 'at'>
): Promise<Highlight> {
	const page = await db
		.selectFrom('page')
		.select('page.id')
		.select((eb) =>
			eb.selectFrom('sentence').whereRef('sentence.page_id', '=', 'page.id').select(eb.fn.countAll<number>().as('n')).as('sentences')
		)
		.where('book_id', '=', bookId)
		.where('position', '=', highlight.page)
		.executeTakeFirst();
	if (!page) throw new InvalidHighlight('No such Page.');
	const count = Number(page.sentences);
	const { first, last } = highlight;
	if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > count) {
		throw new InvalidHighlight(`Page ${highlight.page} has Sentences 1–${count}; a Highlight runs from one of them to the same or a later one.`);
	}
	const note = highlight.note?.trim().replace(/\s+/g, ' ') || undefined;
	if (note && note.length > highlightNoteLength) throw new InvalidHighlight(`A Highlight's note is at most ${highlightNoteLength} characters.`);
	const text = highlight.text?.trim().replace(/\s+/g, ' ') || undefined;
	if (text) {
		const sentences = await db
			.selectFrom('sentence')
			.select('text')
			.where('page_id', '=', page.id)
			.where('position', '>=', first)
			.where('position', '<=', last)
			.orderBy('position')
			.execute();
		if (!passageParts(sentences.map((s) => `${s.text} `), text)) {
			const where = first === last ? `Sentence ${first}` : `Sentences ${first}–${last}`;
			throw new InvalidHighlight(`“${text}” isn't in ${where} of Page ${highlight.page}.`);
		}
	}
	const at = new Date().toISOString();
	await db
		.updateTable('book')
		.set({
			highlight_page: highlight.page,
			highlight_first: first,
			highlight_last: last,
			highlight_text: text ?? null,
			highlight_note: note ?? null,
			highlighted_at: at
		})
		.where('id', '=', bookId)
		.execute();
	return { page: highlight.page, first, last, ...(text ? { text } : {}), ...(note ? { note } : {}), at };
}

const noHighlight = {
	highlight_page: null,
	highlight_first: null,
	highlight_last: null,
	highlight_text: null,
	highlight_note: null,
	highlighted_at: null
};

export async function clearHighlight(db: Kysely<Database>, bookId: number): Promise<void> {
	await db.updateTable('book').set(noHighlight).where('id', '=', bookId).execute();
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
		// A Highlight on a Page you've finished has done its job.
		await trx.updateTable('book').set(noHighlight).where('id', '=', bookId).where('highlight_page', '=', position).execute();
		if (next !== undefined) {
			await trx
				.updateTable('book')
				.set({ bookmark_page: next, bookmark_sentence: 1, bookmark_word: null, bookmarked_at: now })
				.where('id', '=', bookId)
				.execute();
		}
	});
	return next;
}
