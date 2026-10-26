import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { getLanguage, type Language } from './languages';
import { normalise, parserFor, type Parser, type Token } from './parsing';
import { findTerms, type TermView } from './terms';

export const PAGE_WORD_TARGET = 250;

export class InvalidBook extends Error {}

export interface NewBook {
	languageId: number;
	title: string;
	text: string;
}

export interface BookSummary {
	id: number;
	title: string;
	languageName: string;
}

/** A Token on the reading screen. Words carry their Normalised form as `key`. */
export interface ReadingToken extends Token {
	key?: string;
}

export interface PageView {
	book: { id: number; title: string; pageCount: number };
	language: Language;
	position: number;
	paragraphs: { sentences: { tokens: ReadingToken[] }[] }[];
	/** Terms for the Words on this Page, keyed by Normalised form. A Word with no entry is Unknown. */
	terms: Record<string, TermView>;
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

	const parser = parserFor(language);
	const pages = splitIntoPages(input.text, parser);
	if (!pages.some((page) => parser.parse(page).some((p) => p.sentences.some((s) => s.tokens.some((t) => t.isWord))))) {
		throw new InvalidBook('The text has no Words to read.');
	}

	return db.transaction().execute(async (trx) => {
		const book = await trx
			.insertInto('book')
			.values({ language_id: language.id, title, created_at: new Date().toISOString() })
			.returning('id')
			.executeTakeFirstOrThrow();

		for (const [i, text] of pages.entries()) {
			const page = await trx
				.insertInto('page')
				.values({ book_id: book.id, position: i + 1, text })
				.returning('id')
				.executeTakeFirstOrThrow();
			const sentences = parser
				.parse(text)
				.flatMap((p) => p.sentences)
				.map((s, j) => ({ page_id: page.id, position: j + 1, text: s.tokens.map((t) => t.text).join('') }));
			await trx.insertInto('sentence').values(sentences).execute();
		}
		return book.id;
	});
}

export async function listBooks(db: Kysely<Database>): Promise<BookSummary[]> {
	return db
		.selectFrom('book')
		.innerJoin('language', 'language.id', 'book.language_id')
		.select(['book.id', 'book.title', 'language.name as languageName'])
		.orderBy('book.created_at', 'desc')
		.execute();
}

export async function getPage(db: Kysely<Database>, bookId: number, position: number): Promise<PageView | undefined> {
	const row = await db
		.selectFrom('page')
		.innerJoin('book', 'book.id', 'page.book_id')
		.select(['book.id as bookId', 'book.title', 'book.language_id', 'page.text'])
		.select((eb) =>
			eb.selectFrom('page as p').whereRef('p.book_id', '=', 'book.id').select(eb.fn.countAll<number>().as('n')).as('pageCount')
		)
		.where('page.book_id', '=', bookId)
		.where('page.position', '=', position)
		.executeTakeFirst();
	if (!row) return undefined;

	const language = await getLanguage(db, row.language_id);
	if (!language) return undefined;
	const paragraphs = parserFor(language)
		.parse(row.text)
		.map((p) => ({
			sentences: p.sentences.map((s) => ({
				tokens: s.tokens.map((t): ReadingToken => (t.isWord ? { ...t, key: normalise(t.text, language) } : t))
			}))
		}));
	const keys = paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.flatMap((t) => (t.key ? [t.key] : []))));
	return {
		book: { id: row.bookId, title: row.title, pageCount: Number(row.pageCount) },
		language,
		position,
		paragraphs,
		terms: await findTerms(db, language.id, keys)
	};
}
