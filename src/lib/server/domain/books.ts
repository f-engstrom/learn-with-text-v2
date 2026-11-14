import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { frequencyBands, type FrequencyBand } from './frequency';
import { getLanguage, type Language } from './languages';
import { candidateSpans, chooseSpans } from './multiword';
import { countWords, normalise, parserFor, partKeys, type Parser, type Token } from './parsing';
import { findTerms, type TermView } from './terms';
import { Refused } from './refused';

export const PAGE_WORD_TARGET = 250;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class InvalidBook extends Refused {}

/** One web address, one Book: creating a second from the same address is refused. */
export class BookExists extends InvalidBook {
	constructor(readonly bookId: number) {
		super('You already have that page as a Book.');
	}
}

export interface NewBook {
	languageId: number;
	title: string;
	text: string;
	/** The web address it came from, if any. */
	url?: string;
}

export interface BookSummary {
	id: number;
	title: string;
	languageName: string;
	pageCount: number;
	/** How many Pages are Read. */
	readCount: number;
	bookmark: Bookmark;
	/** When the Bookmark last moved (ISO time); undefined if it never has. */
	bookmarkedAt?: string;
	/** Share of the Book's distinct Words that are Unknown, from 0 to 1. */
	unknownShare: number;
}

/**
 * A Token on the reading screen: a Word, a matched Multi-word Term, or what lies between them.
 * Words and Multi-word Terms carry their Normalised form (`key`), their order on the Page
 * (`index`), the index of their Sentence on the Page (`sentence`) and how many Words they span.
 */
export interface ReadingToken extends Token {
	key?: string;
	index?: number;
	sentence?: number;
	words?: number;
}

export interface Bookmark {
	/** 1-based Page position. */
	page: number;
	/** 1-based Sentence position on that Page. */
	sentence: number;
	/** The Word or phrase last selected in that Sentence, as written. */
	word?: string;
}

/** A Bookmark as stored, without empty fields. */
export function toBookmark(row: { bookmark_page: number; bookmark_sentence: number; bookmark_word: string | null }): Bookmark {
	return { page: row.bookmark_page, sentence: row.bookmark_sentence, ...(row.bookmark_word ? { word: row.bookmark_word } : {}) };
}

export interface PageView {
	book: { id: number; title: string; pageCount: number; bookmark: Bookmark };
	language: Language;
	position: number;
	read: boolean;
	paragraphs: { sentences: { tokens: ReadingToken[] }[] }[];
	/**
	 * Terms for the Words and possible phrases on this Page, keyed by Normalised form.
	 * A Word with no entry is Unknown.
	 */
	terms: Record<string, TermView>;
	/** Frequency bands of the Page's Words (not phrases), by Normalised form. */
	frequency: Record<string, FrequencyBand>;
}

/**
 * Splits a Book's text into Page texts. A line containing only `---` always starts a new Page;
 * otherwise a Page ends at the first Sentence boundary after it reaches `wordTarget` Words.
 */
export function splitIntoPages(text: string, parser: Parser, wordTarget = PAGE_WORD_TARGET): string[] {
	const pages: string[] = [];
	for (const part of text.replace(/\r\n?/g, '\n').split(/^[ \t]*---[ \t]*$/m)) {
		let paragraphs: string[][] = [];
		let words = 0;
		const flush = () => {
			const page = paragraphs
				.map((sentences) => sentences.join('').trim())
				.filter((p) => p !== '')
				.join('\n');
			if (page !== '') pages.push(page);
			paragraphs = [];
			words = 0;
		};

		for (const paragraph of parser.parse(part)) {
			paragraphs.push([]);
			for (const sentence of paragraph.sentences) {
				if (words >= wordTarget) {
					flush();
					paragraphs.push([]);
				}
				paragraphs[paragraphs.length - 1].push(sentence.tokens.map((t) => t.text).join(''));
				words += sentence.tokens.filter((t) => t.isWord).length;
			}
		}
		flush();
	}
	return pages;
}

export async function createBook(db: Kysely<Database>, input: NewBook): Promise<number> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidBook('Choose a Language.');
	const title = input.title.trim();
	if (title === '') throw new InvalidBook('Give the Book a title.');

	if (input.url) {
		const had = await findBookByUrl(db, input.url);
		if (had !== undefined) throw new BookExists(had);
	}

	const pages = splitIntoPages(input.text, parserFor(language));
	if (!hasWords(pages, parserFor(language))) throw new InvalidBook('The text has no Words to read.');

	return db.transaction().execute(async (trx) => {
		const book = await trx
			.insertInto('book')
			.values({ language_id: language.id, title, url: input.url ?? null, created_at: new Date().toISOString() })
			.returning('id')
			.executeTakeFirstOrThrow();
		await writePages(trx, book.id, language, pages);
		return book.id;
	});
}

/** What the Edit screen shows of a Book. */
export interface BookDetails {
	id: number;
	title: string;
	languageId: number;
	pageCount: number;
	/** The whole text, a line containing only `---` between its Pages. */
	text: string;
	url?: string;
}

/** The line between Pages in a Book's whole text. */
const PAGE_BREAK = '\n---\n';

export async function getBook(db: Kysely<Database>, bookId: number): Promise<BookDetails | undefined> {
	const row = await db.selectFrom('book').select(['id', 'title', 'language_id', 'url']).where('id', '=', bookId).executeTakeFirst();
	if (!row) return undefined;
	const pages = await db.selectFrom('page').select('text').where('book_id', '=', bookId).orderBy('position').execute();
	return {
		id: row.id,
		title: row.title,
		languageId: row.language_id,
		pageCount: pages.length,
		text: pages.map((p) => p.text).join(PAGE_BREAK),
		...(row.url ? { url: row.url } : {})
	};
}

export interface BookEdit {
	title: string;
	languageId: number;
	/** The whole text, split into Pages as when creating a Book. */
	text: string;
}

/**
 * Changes a Book's title, Language or text. A new text or Language splits the Book into Pages,
 * Sentences and Words again: a Page whose text is unchanged stays Read, the Bookmark stays on its
 * Page (or the last one, if there are fewer now), and the Highlight is cleared.
 */
export async function editBook(db: Kysely<Database>, bookId: number, input: BookEdit): Promise<void> {
	const book = await getBook(db, bookId);
	if (!book) throw new InvalidBook('There is no such Book.');
	const title = input.title.trim();
	if (title === '') throw new InvalidBook('Give the Book a title.');
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidBook('Choose a Language.');
	const parser = parserFor(language);
	const pages = splitIntoPages(input.text, parser);
	if (!hasWords(pages, parser)) throw new InvalidBook('The text has no Words to read.');

	await db.transaction().execute(async (trx) => {
		await trx.updateTable('book').set({ title }).where('id', '=', bookId).execute();
		if (language.id === book.languageId && pages.join(PAGE_BREAK) === book.text) return;

		// Read marks follow the Page's text, wherever it now falls.
		const old = await trx.selectFrom('page').select(['text', 'read_at']).where('book_id', '=', bookId).orderBy('position').execute();
		const readAt = (text: string) => {
			const i = old.findIndex((p) => p.text === text);
			return i === -1 ? null : old.splice(i, 1)[0].read_at;
		};
		// Their Sentences go with them.
		await trx.deleteFrom('page').where('book_id', '=', bookId).execute();
		await trx.deleteFrom('book_word').where('book_id', '=', bookId).execute();
		await writePages(trx, bookId, language, pages, readAt);

		const bookmark = await trx.selectFrom('book').select(['bookmark_page', 'bookmark_sentence', 'bookmark_word']).where('id', '=', bookId).executeTakeFirstOrThrow();
		const page = Math.min(bookmark.bookmark_page, pages.length);
		const sentences = parser.parse(pages[page - 1]).flatMap((p) => p.sentences).length;
		const sentence = Math.max(1, Math.min(bookmark.bookmark_sentence, sentences));
		const moved = page !== bookmark.bookmark_page || sentence !== bookmark.bookmark_sentence;
		await trx
			.updateTable('book')
			.set({
				language_id: language.id,
				bookmark_page: page,
				bookmark_sentence: sentence,
				...(moved ? { bookmark_word: null } : {}),
				highlight_page: null,
				highlight_first: null,
				highlight_last: null,
				highlight_note: null,
				highlight_text: null,
				highlighted_at: null
			})
			.where('id', '=', bookId)
			.execute();
	});
}

function hasWords(pages: string[], parser: Parser): boolean {
	return pages.some((page) => parser.parse(page).some((p) => p.sentences.some((s) => s.tokens.some((t) => t.isWord))));
}

/** Stores a Book's Pages with their Sentences, Read as `readAt` says, and adds their Words to the Book's. */
async function writePages(
	trx: Kysely<Database>,
	bookId: number,
	language: Language,
	pages: string[],
	readAt: (text: string) => string | null = () => null
): Promise<void> {
	const parser = parserFor(language);
	for (const [i, text] of pages.entries()) {
		const paragraphs = parser.parse(text);
		const page = await trx
			.insertInto('page')
			.values({ book_id: bookId, position: i + 1, text, words: countWords(paragraphs), read_at: readAt(text) })
			.returning('id')
			.executeTakeFirstOrThrow();
		await insertSentences(trx, page.id, paragraphs);
	}
	await addBookWords(trx, bookId, language, pages);
}

async function insertSentences(trx: Kysely<Database>, pageId: number, paragraphs: ReturnType<Parser['parse']>): Promise<void> {
	const sentences = paragraphs
		.flatMap((p) => p.sentences)
		.map((s, j) => ({ page_id: pageId, position: j + 1, text: s.tokens.map((t) => t.text).join('') }));
	if (sentences.length > 0) await trx.insertInto('sentence').values(sentences).execute();
}

async function addBookWords(trx: Kysely<Database>, bookId: number, language: Language, pages: string[]): Promise<void> {
	const parser = parserFor(language);
	const words = new Set(
		pages.flatMap((text) =>
			parser.parse(text).flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t) => t.isWord).map((t) => normalise(t.text, language))))
		)
	);
	if (words.size === 0) return;
	await trx
		.insertInto('book_word')
		.values([...words].map((normalised) => ({ book_id: bookId, normalised })))
		.onConflict((oc) => oc.doNothing())
		.execute();
}

/** Every Book, newest first, with its Pages, Bookmark and Unknown share. */
export async function listBooks(db: Kysely<Database>): Promise<BookSummary[]> {
	const rows = await db
		.selectFrom('book')
		.innerJoin('language', 'language.id', 'book.language_id')
		.select([
			'book.id',
			'book.title',
			'language.name as languageName',
			'book.bookmark_page',
			'book.bookmark_sentence',
			'book.bookmark_word',
			'book.bookmarked_at'
		])
		.select((eb) => [
			eb.selectFrom('page').whereRef('page.book_id', '=', 'book.id').select(eb.fn.countAll<number>().as('n')).as('pageCount'),
			eb
				.selectFrom('page')
				.whereRef('page.book_id', '=', 'book.id')
				.where('page.read_at', 'is not', null)
				.select(eb.fn.countAll<number>().as('n'))
				.as('readCount'),
			eb.selectFrom('book_word').whereRef('book_word.book_id', '=', 'book.id').select(eb.fn.countAll<number>().as('n')).as('words'),
			// Unknown means no Term (ADR 0001).
			eb
				.selectFrom('book_word')
				.whereRef('book_word.book_id', '=', 'book.id')
				.where((w) =>
					w.not(
						w.exists(
							w
								.selectFrom('term')
								.whereRef('term.language_id', '=', 'book.language_id')
								.whereRef('term.normalised', '=', 'book_word.normalised')
								.select('term.id')
						)
					)
				)
				.select(eb.fn.countAll<number>().as('n'))
				.as('unknown')
		])
		.orderBy('book.created_at', 'desc')
		.orderBy('book.id', 'desc')
		.execute();
	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		languageName: r.languageName,
		pageCount: Number(r.pageCount),
		readCount: Number(r.readCount),
		bookmark: toBookmark(r),
		...(r.bookmarked_at ? { bookmarkedAt: r.bookmarked_at } : {}),
		unknownShare: Number(r.words) === 0 ? 0 : Number(r.unknown) / Number(r.words)
	}));
}

/** The Book that came from this web address, if you have one. */
export async function findBookByUrl(db: Kysely<Database>, url: string): Promise<number | undefined> {
	const row = await db.selectFrom('book').select('id').where('url', '=', url).executeTakeFirst();
	return row?.id;
}

/** Decodes an uploaded text file, which must be UTF-8. A byte-order mark is dropped. */
export function textFromFile(bytes: Uint8Array): string {
	if (bytes.length > MAX_FILE_BYTES) throw new InvalidBook('The file is larger than 5 MB.');
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new InvalidBook("The file isn't UTF-8 text.");
	}
}

export async function getPage(db: Kysely<Database>, bookId: number, position: number): Promise<PageView | undefined> {
	const row = await db
		.selectFrom('page')
		.innerJoin('book', 'book.id', 'page.book_id')
		.select([
			'book.id as bookId',
			'book.title',
			'book.language_id',
			'book.bookmark_page',
			'book.bookmark_sentence',
			'book.bookmark_word',
			'page.text',
			'page.read_at'
		])
		.select((eb) =>
			eb.selectFrom('page as p').whereRef('p.book_id', '=', 'book.id').select(eb.fn.countAll<number>().as('n')).as('pageCount')
		)
		.where('page.book_id', '=', bookId)
		.where('page.position', '=', position)
		.executeTakeFirst();
	if (!row) return undefined;

	const language = await getLanguage(db, row.language_id);
	if (!language) return undefined;
	const parsed = parserFor(language).parse(row.text);
	const spans = parsed.map((p) => p.sentences.map((s) => candidateSpans(s.tokens, language)));
	const wordKeys = [
		...parsed.flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t) => t.isWord).map((t) => normalise(t.text, language)))),
		...spans.flat(2).map((s) => s.key)
	];
	// Characters within a Word can be Terms of their own, so the Term form can show them.
	const keys = [...new Set([...wordKeys, ...wordKeys.flatMap(partKeys)])];
	const terms = await findTerms(db, language.id, keys);

	let index = 0;
	let sentence = 0;
	const paragraphs = parsed.map((p, i) => ({
		sentences: p.sentences.map((s, j) => {
			const tokens: ReadingToken[] = [];
			const matches = chooseSpans(spans[i][j], (key) => key in terms);
			for (let t = 0; t < s.tokens.length; t++) {
				const match = matches.find((m) => m.start === t);
				if (match) {
					const text = s.tokens.slice(match.start, match.end + 1).map((token) => token.text).join('');
					tokens.push({ text, isWord: true, key: match.key, index: index++, sentence, words: match.words });
					t = match.end;
				} else if (s.tokens[t].isWord) {
					tokens.push({ ...s.tokens[t], key: normalise(s.tokens[t].text, language), index: index++, sentence, words: 1 });
				} else {
					tokens.push(s.tokens[t]);
				}
			}
			sentence++;
			return { tokens };
		})
	}));
	return {
		book: {
			id: row.bookId,
			title: row.title,
			pageCount: Number(row.pageCount),
			bookmark: toBookmark(row)
		},
		language,
		position,
		read: row.read_at !== null,
		paragraphs,
		terms,
		frequency: await frequencyBands(db, language, keys)
	};
}
