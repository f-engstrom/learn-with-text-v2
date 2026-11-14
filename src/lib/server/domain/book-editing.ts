import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { addBookWords, findBookByUrl, hasWords, insertSentences, InvalidBook, splitIntoPages } from './books';
import { getLanguage } from './languages';
import { countWords, parserFor, type Parser } from './parsing';
import { joinTexts } from '../../pages';
import { cleanChapterTitle } from '../../chapters';

/** A Page as the edit screen and the Tutor see it. */
export interface EditablePage {
	id: number;
	/** 1-based. */
	position: number;
	text: string;
	/** When it was marked Read; null while it isn't. */
	readAt: string | null;
	words: number;
	/** The title of the Chapter it starts, empty for an untitled one; null if it starts none (ADR 0009). */
	chapter: string | null;
}

/** What the edit screen shows of a Book. */
export interface BookForEditing {
	id: number;
	title: string;
	languageId: number;
	url?: string;
	pages: EditablePage[];
	/** The Page the Bookmark is on. */
	bookmarkPageId: number;
}

export async function getBookForEditing(db: Kysely<Database>, bookId: number): Promise<BookForEditing | undefined> {
	const book = await db
		.selectFrom('book')
		.select(['id', 'title', 'language_id', 'url', 'bookmark_page'])
		.where('id', '=', bookId)
		.executeTakeFirst();
	if (!book) return undefined;
	const pages = await listPages(db, bookId);
	return {
		id: book.id,
		title: book.title,
		languageId: book.language_id,
		...(book.url ? { url: book.url } : {}),
		pages,
		bookmarkPageId: (pages[book.bookmark_page - 1] ?? pages.at(-1))!.id
	};
}

/** A Book's Pages in order, `from` and `to` (1-based, inclusive) narrowing them. */
export async function listPages(db: Kysely<Database>, bookId: number, from = 1, to = Number.MAX_SAFE_INTEGER): Promise<EditablePage[]> {
	const rows = await db
		.selectFrom('page')
		.select(['id', 'position', 'text', 'read_at', 'words', 'chapter'])
		.where('book_id', '=', bookId)
		.where('position', '>=', from)
		.where('position', '<=', to)
		.orderBy('position')
		.execute();
	return rows.map((r) => ({ id: r.id, position: r.position, text: r.text, readAt: r.read_at, words: r.words, chapter: r.chapter }));
}

/** One Page in an edit, in its new place: an existing Page by id, or a new one with no id. */
export interface PageEdit {
	id: number | null;
	/** A line containing only `---` splits it: the first part keeps the Page, the rest are new. */
	text: string;
	/** false takes away the Page's Read mark. A Page is marked Read only in the reading screen. */
	read?: boolean;
	/**
	 * The title of the Chapter it starts ('' for an untitled one), or null for none; left out, an
	 * existing Page keeps its mark. Of a split Page only the first part keeps it.
	 */
	chapter?: string | null;
}

export interface BookEdit {
	title: string;
	languageId: number;
	/** The web address it came from; blank or null for none. */
	url?: string | null;
	/** Every Page the Book keeps, in order. A Page left out is removed. */
	pages: PageEdit[];
}

/**
 * Changes a Book: its title, Language, web address and Pages (ADR 0008). A Page keeps its Read mark
 * and the Bookmark wherever it moves and however its text changes; its Words are counted again.
 * The Bookmark on a removed Page moves to the next kept one (or the last); on a changed Page it
 * keeps its Sentence where it can. The Highlight stays only while its Page and Language are unchanged.
 */
export async function editBook(db: Kysely<Database>, bookId: number, input: BookEdit): Promise<void> {
	const book = await db
		.selectFrom('book')
		.select(['language_id', 'bookmark_page', 'bookmark_sentence', 'highlight_page'])
		.where('id', '=', bookId)
		.executeTakeFirst();
	if (!book) throw new InvalidBook('There is no such Book.');
	const title = input.title.trim();
	if (title === '') throw new InvalidBook('Give the Book a title.');
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidBook('Choose a Language.');
	const url = await checkUrl(db, bookId, input.url);
	const parser = parserFor(language);

	const old = await listPages(db, bookId);
	const byId = new Map(old.map((p) => [p.id, p]));
	const pages = planPages(input.pages, byId, parser);
	if (!hasWords(pages.map((p) => p.text), parser)) throw new InvalidBook('The text has no Words to read.');

	const relanguaged = language.id !== book.language_id;
	const kept = new Map(pages.flatMap((p, i) => (p.id === null ? [] : [[p.id, i + 1] as const])));
	const unchanged = (id: number) => !relanguaged && pages.find((p) => p.id === id)?.text === byId.get(id)?.text;

	await db.transaction().execute(async (trx) => {
		const removed = old.filter((p) => !kept.has(p.id)).map((p) => p.id);
		if (removed.length > 0) await trx.deleteFrom('page').where('id', 'in', removed).execute();
		// Out of the way of the new positions, which must stay unique within the Book.
		await trx
			.updateTable('page')
			.set((eb) => ({ position: eb.neg(eb.ref('id')) }))
			.where('book_id', '=', bookId)
			.execute();

		for (const [i, page] of pages.entries()) {
			const paragraphs = parser.parse(page.text);
			const values = { position: i + 1, text: page.text, read_at: page.readAt, words: countWords(paragraphs), chapter: page.chapter };
			if (page.id === null) {
				const row = await trx
					.insertInto('page')
					.values({ book_id: bookId, ...values })
					.returning('id')
					.executeTakeFirstOrThrow();
				await insertSentences(trx, row.id, paragraphs);
			} else {
				await trx.updateTable('page').set(values).where('id', '=', page.id).execute();
				if (!unchanged(page.id)) {
					await trx.deleteFrom('sentence').where('page_id', '=', page.id).execute();
					await insertSentences(trx, page.id, paragraphs);
				}
			}
		}

		await trx.deleteFrom('book_word').where('book_id', '=', bookId).execute();
		await addBookWords(
			trx,
			bookId,
			language,
			pages.map((p) => p.text)
		);

		await trx
			.updateTable('book')
			.set({
				title,
				url,
				language_id: language.id,
				...followBookmark(book, old, kept, unchanged, (position) => parser.parse(pages[position - 1].text)),
				...followHighlight(book.highlight_page, old, kept, unchanged)
			})
			.where('id', '=', bookId)
			.execute();
	});
}

/** The Pages an edit leaves, in order, each part of a split one of its own. */
function planPages(
	edits: PageEdit[],
	byId: Map<number, EditablePage>,
	parser: Parser
): { id: number | null; text: string; readAt: string | null; chapter: string | null }[] {
	const seen = new Set<number>();
	return edits.flatMap((edit) => {
		const page = edit.id === null ? undefined : byId.get(edit.id);
		if (edit.id !== null && (!page || seen.has(edit.id))) throw new InvalidBook('A Page in the edit is not one of this Book’s.');
		if (edit.id !== null) seen.add(edit.id);
		// The same paragraphs and `---` lines as when creating a Book, but no Page is split for its length.
		const parts = splitIntoPages(edit.text, parser, Number.POSITIVE_INFINITY);
		if (page && parts.length === 0) throw new InvalidBook(`Page ${page.position} has no text; remove it instead.`);
		const readAt = page && edit.read !== false ? page.readAt : null;
		const mark = edit.chapter === undefined ? (page?.chapter ?? null) : edit.chapter;
		const chapter = mark === null ? null : cleanChapterTitle(mark);
		return parts.map((text, i) => ({ id: i === 0 && page ? page.id : null, text, readAt, chapter: i === 0 ? chapter : null }));
	});
}

/** A web address for the Book: blank for none, else http(s) and not another Book's. */
async function checkUrl(db: Kysely<Database>, bookId: number, url: string | null | undefined): Promise<string | null> {
	const address = url?.trim() ?? '';
	if (address === '') return null;
	let parsed: URL;
	try {
		parsed = new URL(address);
	} catch {
		throw new InvalidBook('The web address isn’t one.');
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new InvalidBook('The web address must start with http or https.');
	const other = await findBookByUrl(db, address);
	if (other !== undefined && other !== bookId) throw new InvalidBook('Another Book came from that web address.');
	return address;
}

type Bookmarked = { bookmark_page: number; bookmark_sentence: number };

/** The Bookmark goes with its Page; from a removed one to the next kept Page, or the last. */
function followBookmark(
	book: Bookmarked,
	old: EditablePage[],
	kept: Map<number, number>,
	unchanged: (id: number) => boolean,
	parse: (position: number) => ReturnType<Parser['parse']>
): { bookmark_page: number; bookmark_sentence: number; bookmark_word?: null } {
	const from = old[book.bookmark_page - 1] ?? old.at(-1)!;
	const position = kept.get(from.id);
	if (position === undefined) {
		const next = old.slice(old.indexOf(from) + 1).find((p) => kept.has(p.id));
		return { bookmark_page: next ? kept.get(next.id)! : kept.size, bookmark_sentence: 1, bookmark_word: null };
	}
	if (unchanged(from.id)) return { bookmark_page: position, bookmark_sentence: book.bookmark_sentence };
	const sentences = parse(position).flatMap((p) => p.sentences).length;
	return { bookmark_page: position, bookmark_sentence: Math.max(1, Math.min(book.bookmark_sentence, sentences)), bookmark_word: null };
}

/** The Highlight goes with its Page while that Page's text and the Language stay as they were. */
function followHighlight(page: number | null, old: EditablePage[], kept: Map<number, number>, unchanged: (id: number) => boolean) {
	const from = page === null ? undefined : old[page - 1];
	if (from && kept.has(from.id) && unchanged(from.id)) return { highlight_page: kept.get(from.id)! };
	return {
		highlight_page: null,
		highlight_first: null,
		highlight_last: null,
		highlight_note: null,
		highlight_text: null,
		highlighted_at: null
	};
}

/** One change the Tutor makes to a Book's Pages, naming Pages by id. */
export type PageOperation =
	| { op: 'set_text'; page: number; text: string }
	| { op: 'remove'; page: number }
	| { op: 'join_next'; page: number }
	| { op: 'move'; page: number; after: number | null }
	| { op: 'add'; after: number | null; text: string }
	| { op: 'set_chapter'; page: number; title: string | null };

/** A Read Page is the learner's: the Tutor may not change, remove, join or move it, only mark where a Chapter starts. */
export class ReadPageRefused extends InvalidBook {
	constructor(position: number) {
		super(`Page ${position} is Read, so it is the learner's to change. Ask them first, or leave it.`);
	}
}

/**
 * The Tutor's cleanup of a Book, as operations applied in order and saved at once with `editBook`;
 * the Language and web address stay. Pages that are Read are left alone (ReadPageRefused).
 */
export async function editPagesAsTutor(db: Kysely<Database>, bookId: number, input: { title?: string; operations: PageOperation[] }): Promise<void> {
	const book = await db.selectFrom('book').select(['title', 'language_id', 'url']).where('id', '=', bookId).executeTakeFirst();
	if (!book) throw new InvalidBook('There is no such Book.');
	const old = await listPages(db, bookId);
	const pages: (PageEdit & { readAt?: string | null; position?: number })[] = old.map((p) => ({
		id: p.id,
		text: p.text,
		readAt: p.readAt,
		position: p.position,
		chapter: p.chapter
	}));

	const find = (id: number) => {
		const i = pages.findIndex((p) => p.id === id);
		if (i === -1) throw new InvalidBook(`There is no Page ${id} in this Book now; ids come from get_pages.`);
		return i;
	};
	const unread = (i: number) => {
		if (pages[i].readAt) throw new ReadPageRefused(pages[i].position!);
		return i;
	};
	const at = (after: number | null) => (after === null ? 0 : find(after) + 1);

	for (const operation of input.operations) {
		switch (operation.op) {
			case 'set_text':
				pages[unread(find(operation.page))].text = operation.text;
				break;
			case 'remove':
				pages.splice(unread(find(operation.page)), 1);
				break;
			case 'join_next': {
				const i = unread(find(operation.page));
				if (i === pages.length - 1) throw new InvalidBook('The last Page has no next Page to join.');
				unread(i + 1);
				pages[i].text = joinTexts(pages[i].text, pages[i + 1].text);
				pages.splice(i + 1, 1);
				break;
			}
			case 'move': {
				const [page] = pages.splice(unread(find(operation.page)), 1);
				pages.splice(at(operation.after), 0, page);
				break;
			}
			case 'add':
				pages.splice(at(operation.after), 0, { id: null, text: operation.text });
				break;
			case 'set_chapter':
				// A mark changes nothing the learner read, so Read Pages take one too.
				pages[find(operation.page)].chapter = operation.title;
				break;
		}
	}

	await editBook(db, bookId, {
		title: input.title ?? book.title,
		languageId: book.language_id,
		url: book.url,
		pages: pages.map(({ id, text, chapter }) => ({ id, text, chapter }))
	});
}
