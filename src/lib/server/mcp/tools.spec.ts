import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { createBook } from '../domain/books';
import { listLanguages } from '../domain/languages';
import { setBookmark } from '../domain/reading';
import type { SuggestionSources } from '../domain/suggestions';
import { saveTerm } from '../domain/terms';
import { createReaderServer } from './tools';

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
	await createReaderServer(db, sources).connect(serverSide);
	const client = new Client({ name: 'test', version: '1' });
	await client.connect(clientSide);
	const call = async (name: string, args: Record<string, unknown> = {}) => {
		const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
		return result.isError ? { error: result.content[0].text } : JSON.parse(result.content[0].text);
	};
	return { db, bookId, call, client };
}

describe('Reader MCP server', () => {
	it('offers only read-only tools', async () => {
		const { client } = await connect();
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).toSorted()).toEqual(['get_bookmark', 'get_sentences', 'get_suggestions', 'list_books', 'list_languages', 'look_up_term']);
		expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
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
		expect(result.sentences.map((s: { text: string; isBookmark: boolean }) => [s.text, s.isBookmark])).toEqual([
			['В течение дня кот спит.', true],
			['Мышь бежит.', false]
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
});
