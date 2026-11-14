import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { editBook, editPagesAsTutor, listPages, ReadPageRefused } from './book-editing';
import { createBook, getPage, splitIntoPages } from './books';
import { chapterAt, chaptersOf, detectChapters, listChapters, splitIntoChapters } from './chapters';
import { listLanguages } from './languages';
import { parserFor } from './parsing';
import { markPageRead } from './reading';

const parser = parserFor({ code: 'ru' });
/** About `n` Words of prose. */
const prose = (n: number) => Array.from({ length: n / 5 }, () => 'Он шёл домой очень долго.').join(' ');

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const russian = (await listLanguages(db)).find((l) => l.name === 'Russian')!;
	const create = (text: string) => createBook(db, { languageId: russian.id, title: 'Книга', text });
	return { db, russian, create };
}

describe('detectChapters', () => {
	it('marks headings like "Глава 3", "CHAPTER I." and "IV. Бал", with a short subtitle straight after', () => {
		const text = ['Предисловие.', 'Глава 1', 'В которой всё начинается', prose(40), '', 'IV. Бал', prose(40), 'CHAPTER I.', prose(40)].join('\n');
		const marked = detectChapters(text, parser).split('\n');
		expect(marked.filter((l) => l.startsWith('# '))).toEqual(['# Глава 1', '# В которой всё начинается', '# IV. Бал', '# CHAPTER I.']);
	});

	it('leaves out a table of contents and a Part over its first Chapter, whose Chapters would be too short', () => {
		const text = ['Глава 1', 'Глава 2', '', 'Часть первая', 'Глава 1', prose(40), 'Глава 2', prose(40)].join('\n');
		const marked = detectChapters(text, parser).split('\n');
		expect(marked.map((l, i) => (l.startsWith('# ') ? i : -1)).filter((i) => i >= 0)).toEqual([4, 6]);
	});

	it('marks nothing for a single heading, prose that starts like one, or lower-case Roman letters', () => {
		expect(detectChapters(['Глава 1', prose(40)].join('\n'), parser)).not.toContain('# ');
		const prosey = ['Глава семьи пришёл домой поздно, и все уже спали в доме у реки.', prose(40), 'mix', prose(40), 'civil', prose(40)].join('\n');
		expect(detectChapters(prosey, parser)).toBe(prosey);
	});

	it('leaves a text that already has # lines as it is', () => {
		const text = ['# Начало', prose(10), 'Глава 1', prose(40), 'Глава 2', prose(40)].join('\n');
		expect(detectChapters(text, parser)).toBe(text);
	});
});

describe('splitIntoChapters', () => {
	it('starts a Page at each # line, its title on the Page and the heading kept in the text without the #', () => {
		const pages = splitIntoChapters('Пролог.\n# Глава 1\n#  Бал \nТекст.\n---\nЕщё.\n# Глава 2\nКонец.', (t) => splitIntoPages(t, parser));
		expect(pages).toEqual([
			{ text: 'Пролог.', chapter: null },
			{ text: 'Глава 1\nБал\nТекст.', chapter: 'Глава 1 · Бал' },
			{ text: 'Ещё.', chapter: null },
			{ text: 'Глава 2\nКонец.', chapter: 'Глава 2' }
		]);
	});
});

describe('chaptersOf and chapterAt', () => {
	const chapters = chaptersOf([
		{ position: 1, chapter: null, read: true },
		{ position: 2, chapter: 'Бал', read: true },
		{ position: 3, chapter: null, read: false },
		{ position: 4, chapter: '', read: false }
	]);

	it('runs each Chapter to the next mark, counting its Read Pages, and names an untitled one by its number', () => {
		expect(chapters).toEqual([
			{ number: 1, title: 'Бал', label: 'Бал', first: 2, last: 3, read: 1 },
			{ number: 2, title: '', label: 'Chapter 2', first: 4, last: 4, read: 0 }
		]);
	});

	it('places a Page in its Chapter, and one before the first mark in none', () => {
		expect(chapterAt(chapters, 3)).toEqual({ number: 1, label: 'Бал', page: 2, pages: 2 });
		expect(chapterAt(chapters, 1)).toBeUndefined();
	});
});

describe('Chapters in a Book', () => {
	it('come from the headings found when the Book is created, each starting a Page', async () => {
		const { db, create } = await setup();
		const id = await create(['Глава 1', prose(40), 'Глава 2', prose(40)].join('\n'));
		expect((await listChapters(db, id)).map((c) => [c.label, c.first])).toEqual([
			['Глава 1', 1],
			['Глава 2', 2]
		]);
		const page = await getPage(db, id, 2);
		expect(page?.chapter).toEqual({ number: 2, label: 'Глава 2', page: 1, pages: 1 });
		expect(page?.paragraphs[0].sentences[0].tokens.map((t) => t.text).join('')).toBe('Глава 2');
	});

	it('follow their Page when it moves, keep to the first part of a split, and are set or cleared by editing', async () => {
		const { db, create, russian } = await setup();
		const id = await create('# Один\nРаз.\n---\nДва.\n---\nТри.');
		const [one, two, three] = await listPages(db, id);
		await editBook(db, id, {
			title: 'Книга',
			languageId: russian.id,
			pages: [
				{ id: two.id, text: two.text, chapter: ' Новая  глава ' },
				{ id: one.id, text: `${one.text}\n---\nПолтора.` },
				{ id: three.id, text: three.text }
			]
		});
		expect((await listPages(db, id)).map((p) => [p.text, p.chapter])).toEqual([
			['Два.', 'Новая глава'],
			['Один\nРаз.', 'Один'],
			['Полтора.', null],
			['Три.', null]
		]);
	});

	it('are marked by the Tutor on a Read Page too, though its text stays the learner’s', async () => {
		const { db, create } = await setup();
		const id = await create('Раз.\n---\nДва.');
		const [one] = await listPages(db, id);
		await markPageRead(db, id, 1);
		await editPagesAsTutor(db, id, { operations: [{ op: 'set_chapter', page: one.id, title: 'Начало' }] });
		expect((await listPages(db, id))[0]).toMatchObject({ chapter: 'Начало', readAt: expect.any(String) });
		await expect(editPagesAsTutor(db, id, { operations: [{ op: 'set_text', page: one.id, text: 'Нет.' }] })).rejects.toThrow(ReadPageRefused);
	});
});
