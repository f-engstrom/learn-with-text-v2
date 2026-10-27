import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { createBook, getPage, listBooks } from '../domain/books';
import { listLanguages } from '../domain/languages';
import { setBookmark } from '../domain/reading';
import type { SuggestionSources } from '../domain/suggestions';
import { listTerms, saveTerm } from '../domain/terms';
import { createReaderServer, wikipediaTitle } from './tools';

const words = (n: number) => Array.from({ length: n }, () => 'кот').join(' ') + '.';
const sources: SuggestionSources = {
	wikipedia: { search: async () => [], random: async () => ['Кот'], article: async (_c, title) => ({ title, url: 'https://ru.wikipedia.org/wiki/Кот', text: words(100) }) }
};

async function connect() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const russian = (await listLanguages(db)).find((l) => l.code === 'ru')!;
	const bookId = await createBook(db, {
		languageId: russian.id,
		title: 'Кот',
		text: 'В течение дня кот спит. Мышь бежит. Кот видит мышь.\n---\nКонец.'
	});
	await saveTerm(db, { languageId: russian.id, text: 'в течение', status: 'learning2', translations: [{ text: 'during' }] });
	await saveTerm(db, { languageId: russian.id, text: 'кот', status: 'learning1', translations: [{ text: 'cat', source: 'wiktionary' }] });
	await saveTerm(db, { languageId: russian.id, text: 'спит', status: 'known', parent: 'спать' });

	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	const article = async (url: string) => {
		if (url.includes('missing')) throw new (await import('../domain/webpages')).InvalidAddress('The site answered 404.');
		return { url: `${url}?final`, title: 'Новости', text: 'Сегодня тепло. Кот гуляет.' };
	};
	await createReaderServer(db, sources, article).connect(serverSide);
	const client = new Client({ name: 'test', version: '1' });
	await client.connect(clientSide);
	const call = async (name: string, args: Record<string, unknown> = {}) => {
		const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
		return result.isError ? { error: result.content[0].text } : JSON.parse(result.content[0].text);
	};
	return { db, bookId, call, client };
}

describe('Reader MCP server', () => {
	it('marks which tools only read', async () => {
		const { client } = await connect();
		const { tools } = await client.listTools();
		const readOnly = Object.fromEntries(tools.map((t) => [t.name, t.annotations?.readOnlyHint]));
		expect(readOnly).toEqual({
			list_languages: true,
			list_books: true,
			get_bookmark: true,
			get_sentences: true,
			look_up_term: true,
			get_suggestions: true,
			save_gloss: false,
			adjust_learning: false,
			set_parent: false,
			set_bookmark: false,
			mark_page_read: false,
			import_book: false
		});
	});

	it('lists Books with their Bookmark and Unknown share', async () => {
		const { call, bookId } = await connect();
		const [book] = await call('list_books');
		expect(book).toMatchObject({ id: bookId, title: 'Кот', languageName: 'Russian', pageCount: 2, bookmark: { page: 1, sentence: 1 } });
		expect(book.unknownShare).toBeGreaterThan(0);
	});

	it('says where the learner is', async () => {
		const { db, call, bookId } = await connect();
		await setBookmark(db, bookId, { page: 1, sentence: 2 });
		expect(await call('get_bookmark', { book_id: bookId })).toEqual({
			book: { id: bookId, title: 'Кот', language: 'Russian', pageCount: 2 },
			bookmark: { page: 1, sentence: 2 },
			sentence: 'Мышь бежит.'
		});
		expect(await call('get_bookmark', { book_id: 999 })).toEqual({ error: 'There is no Book 999.' });
	});

	it("gives Sentences from the Bookmark with each Word's Status, and which Words are still Unknown", async () => {
		const { call, bookId } = await connect();
		const result = await call('get_sentences', { book_id: bookId, count: 2 });
		expect(result.sentences.map((s: { text: string; isBookmark: boolean; paragraph: number }) => [s.text, s.isBookmark, s.paragraph])).toEqual([
			['В течение дня кот спит.', true, 1],
			['Мышь бежит.', false, 1]
		]);
		expect(result.sentences[0].words).toEqual([
			{ text: 'В течение', multiWord: true, status: 'learning2', translations: ['during'] },
			{ text: 'дня', status: 'unknown' },
			{ text: 'кот', status: 'learning1', translations: ['cat (wiktionary)'] },
			{ text: 'спит', status: 'known', translations: [], parent: 'спать', followsParent: false }
		]);
		expect(result.unknown).toEqual(['дня', 'мышь', 'бежит']);
		expect(result.nextPage).toBeUndefined();
	});

	it('reads any Page and Sentence, and says when to go on to the next Page', async () => {
		const { call, bookId } = await connect();
		const result = await call('get_sentences', { book_id: bookId, page: 1, sentence: 3 });
		expect(result.sentences.map((s: { position: number }) => s.position)).toEqual([3]);
		expect(result.nextPage).toBe(2);
		expect(await call('get_sentences', { book_id: bookId, page: 5 })).toEqual({ error: `Book ${bookId} has no Page 5.` });
	});

	it('looks up a Term by any spelling, by Language name or code', async () => {
		const { call } = await connect();
		expect(await call('look_up_term', { language: 'ru', text: 'КОТ' })).toEqual({ text: 'кот', status: 'learning1', translations: ['cat (wiktionary)'] });
		expect(await call('look_up_term', { language: 'Russian', text: 'В  тече́ние' })).toMatchObject({ text: 'в течение', status: 'learning2' });
		expect(await call('look_up_term', { language: 'russian', text: 'мышь' })).toEqual({ text: 'мышь', status: 'unknown' });
		expect(await call('look_up_term', { language: 'Klingon', text: 'x' })).toEqual({ error: 'Unknown Language "Klingon". Use list_languages.' });
	});

	it('gives ranked Suggestions with whether each fits', async () => {
		const { call } = await connect();
		const result = await call('get_suggestions', { language: 'ru' });
		expect(result.fitRange).toEqual({ min: 0.05, max: 0.15 });
		expect(result.suggestions).toEqual([
			{ title: 'Кот', url: 'https://ru.wikipedia.org/wiki/Кот', unknownShare: 0, pageCount: 1, fits: false }
		]);
	});

	it('saves a Gloss that the reading screen and the Term list then show', async () => {
		const { db, call, bookId } = await connect();
		expect(await call('save_gloss', { language: 'ru', text: 'дня', gloss: 'of the day' })).toMatchObject({ status: 'learning1', added: true });
		const page = await getPage(db, bookId, 1);
		expect(page!.terms['дня']).toMatchObject({ status: 'learning1', translations: [{ text: 'of the day', source: 'tutor' }] });
		expect((await listTerms(db, { source: 'tutor' })).terms.map((t) => t.text)).toEqual(['дня']);
		expect(await call('save_gloss', { language: 'ru', text: 'спит', gloss: 'sleeps' })).toEqual({
			error: '“спит” is Known; Glosses are only for Unknown Words and Learning 1–2 Terms.'
		});
	});

	it('adjusts a Learning level one step, and refuses Known Terms', async () => {
		const { call } = await connect();
		expect(await call('adjust_learning', { language: 'ru', text: 'кот', direction: 'up' })).toEqual({ from: 'learning1', to: 'learning2' });
		expect(await call('adjust_learning', { language: 'ru', text: 'спит', direction: 'down' })).toEqual({
			error: '“спит” is Known; the Tutor only adjusts Learning 1–4.'
		});
	});

	it('links a glossed form to its dictionary form, which get_sentences then shows', async () => {
		const { call, bookId } = await connect();
		await call('save_gloss', { language: 'ru', text: 'дня', gloss: 'of the day' });
		expect(await call('set_parent', { language: 'ru', text: 'дня', parent: 'день' })).toEqual({ term: 'дня', parent: 'день', createdParent: true });
		const word = (await call('get_sentences', { book_id: bookId, count: 1 })).sentences[0].words[1];
		expect(word).toEqual({ text: 'дня', status: 'learning1', translations: ['of the day (tutor)'], parent: 'день', followsParent: false });
		expect(await call('set_parent', { language: 'ru', text: 'мышь', parent: 'мышь' })).toEqual({
			error: '“мышь” is Unknown; save a Gloss first to give it a Term.'
		});
	});

	it('moves the Bookmark and marks Pages Read', async () => {
		const { call, bookId } = await connect();
		expect(await call('set_bookmark', { book_id: bookId, page: 1, sentence: 3 })).toEqual({ bookmark: { page: 1, sentence: 3 } });
		expect(await call('set_bookmark', { book_id: bookId, page: 9 })).toEqual({ error: 'No such Page.' });
		expect(await call('mark_page_read', { book_id: bookId, page: 1 })).toEqual({ read: 1, bookmark: { page: 2, sentence: 1 }, nextPage: 2 });
		expect((await call('look_up_term', { language: 'ru', text: 'мышь' })).status).toBe('unknown');
	});

	it('imports a Book from text or a web address, once per address', async () => {
		const { db, call } = await connect();
		const fromText = await call('import_book', { language: 'Russian', title: 'Утро', text: 'Утро. Солнце.' });
		const fromWeb = await call('import_book', { language: 'ru', url: 'https://news.example/a' });
		expect(fromWeb).toMatchObject({ title: 'Новости' });
		expect(await call('import_book', { language: 'ru', url: 'https://news.example/a' })).toEqual({ bookId: fromWeb.bookId, alreadyHad: true });
		expect((await listBooks(db)).map((b) => [b.id, b.title])).toEqual(
			expect.arrayContaining([
				[fromText.bookId, 'Утро'],
				[fromWeb.bookId, 'Новости']
			])
		);
		expect(await call('import_book', { language: 'ru', title: 'x' })).toEqual({ error: 'Give either text or url.' });
		expect(await call('import_book', { language: 'ru', url: 'https://news.example/missing' })).toEqual({ error: 'The site answered 404.' });
		expect(await call('import_book', { language: 'ru', title: ' ', text: 'Кот.' })).toEqual({ error: 'Give the Book a title.' });
	});

	it('imports a Wikipedia address through the Wikipedia API, like a Suggestion', async () => {
		const { call } = await connect();
		const result = await call('import_book', { language: 'ru', url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%BE%D1%82' });
		expect(result).toMatchObject({ title: 'Кот' });
		expect(await call('import_book', { language: 'ru', url: 'https://ru.wikipedia.org/wiki/Кот' })).toEqual({ bookId: result.bookId, title: 'Кот' });
	});
});

describe('wikipediaTitle', () => {
	it("reads the title from an address on the Language's Wikipedia only", () => {
		expect(wikipediaTitle('https://ru.wikipedia.org/wiki/%D0%A4%D1%83%D1%82%D0%B1%D0%BE%D0%BB', 'ru')).toBe('Футбол');
		expect(wikipediaTitle('https://ru.m.wikipedia.org/wiki/Футбольная_лига', 'ru')).toBe('Футбольная лига');
		expect(wikipediaTitle('https://en.wikipedia.org/wiki/Football', 'ru')).toBeUndefined();
		expect(wikipediaTitle('https://news.example/wiki/x', 'ru')).toBeUndefined();
	});
});
