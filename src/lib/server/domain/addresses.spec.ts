import { describe, it, expect, vi } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { importFromAddress, readAddress, type AddressSources } from './addresses';
import { BookExists, createBook } from './books';
import { CLASSICS, classicUrl } from './classics';
import { listLanguages } from './languages';
import { InvalidAddress } from './webpages';

const words = (n: number) => Array.from({ length: n }, (_, i) => `слово${i}`).join(' ') + '.';
const classic = CLASSICS.ru[0];

async function setup(over: Partial<AddressSources> = {}) {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const russian = (await listLanguages(db)).find((l) => l.code === 'ru')!;
	const sources: AddressSources = {
		wikipedia: {
			search: async () => [],
			random: async () => [],
			article: vi.fn(async (_code: string, title: string) =>
				title === 'Кот' ? { title, url: 'https://ru.wikipedia.org/wiki/Кот', text: words(50) } : undefined
			)
		},
		wikisource: { text: vi.fn(async () => `${classic.title}\n\n${words(50)}`) },
		readArticle: vi.fn(async (url: string) => ({ url: url.replace('/r/', '/'), title: 'Новости', text: words(50) })),
		...over
	};
	return { db, russian, sources };
}

describe('readAddress', () => {
	it('reads a Wikipedia address through its API, and says when there is no such article', async () => {
		const { russian, sources } = await setup();
		expect(await readAddress(sources, russian, 'https://ru.m.wikipedia.org/wiki/Кот')).toMatchObject({ title: 'Кот' });
		expect(sources.readArticle).not.toHaveBeenCalled();
		await expect(readAddress(sources, russian, 'https://ru.wikipedia.org/wiki/Нет')).rejects.toThrow(InvalidAddress);
	});

	it('reads a Classic whole through Wikisource, without its title line, and says when it is gone', async () => {
		const { russian, sources } = await setup();
		const read = await readAddress(sources, russian, classicUrl(classic));
		expect(read).toMatchObject({ title: classic.title, url: classicUrl(classic) });
		expect(read.text.startsWith(classic.title)).toBe(false);
		const gone = await setup({ wikisource: { text: async () => undefined } });
		await expect(readAddress(gone.sources, gone.russian, classicUrl(classic))).rejects.toThrow(/any more/);
	});

	it('reads any other page as an article', async () => {
		const { russian, sources } = await setup();
		expect(await readAddress(sources, russian, 'https://news.example/a')).toMatchObject({ title: 'Новости' });
	});
});

describe('One web address, one Book', () => {
	it('imports a page once, and gives back the Book you have the second time, without reading it again', async () => {
		const { db, russian, sources } = await setup();
		const first = await importFromAddress(db, sources, russian, 'https://news.example/a', '  Утро ');
		expect(first).toMatchObject({ title: 'Утро' });
		expect(await importFromAddress(db, sources, russian, 'https://news.example/a')).toEqual({ bookId: first.bookId, alreadyHad: true });
		expect(sources.readArticle).toHaveBeenCalledTimes(1);
	});

	it('knows a page it was sent on to from an address you already have', async () => {
		const { db, russian, sources } = await setup();
		const first = await importFromAddress(db, sources, russian, 'https://news.example/a');
		expect(await importFromAddress(db, sources, russian, 'https://news.example/r/a')).toEqual({ bookId: first.bookId, alreadyHad: true });
	});

	it('is refused by createBook, and by the database itself', async () => {
		const { db, russian } = await setup();
		const bookId = await createBook(db, { languageId: russian.id, title: 'Кот', text: words(5), url: 'https://news.example/a' });
		await expect(createBook(db, { languageId: russian.id, title: 'Кот', text: words(5), url: 'https://news.example/a' })).rejects.toEqual(new BookExists(bookId));
		const other = await createBook(db, { languageId: russian.id, title: 'Пёс', text: words(5) });
		await expect(db.updateTable('book').set({ url: 'https://news.example/a' }).where('id', '=', other).execute()).rejects.toThrow(/UNIQUE/);
	});
});
