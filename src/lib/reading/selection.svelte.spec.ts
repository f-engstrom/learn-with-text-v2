import { describe, it, expect, vi } from 'vitest';
import type { Bookmark } from '#lib/server/domain/books.ts';
import { openDatabase } from '#lib/server/db/open.ts';
import { migrateToLatest } from '#lib/server/db/migrate.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import { createBook, getPage } from '#lib/server/domain/books.ts';
import { setBookmark } from '#lib/server/domain/reading.ts';
import { saveTerm } from '#lib/server/domain/terms.ts';
import { Selection } from './selection.svelte.ts';

async function setup(code: string, text: string) {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const language = (await listLanguages(db)).find((l) => l.code === code)!;
	const bookId = await createBook(db, { languageId: language.id, title: 'Test', text });
	const page = async () => (await getPage(db, bookId, 1))!;
	return { db, language, bookId, page };
}

function open(page: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['page']>>) {
	const saved: Bookmark[] = [];
	const onMoved = vi.fn();
	const selection = new Selection(page, { saveBookmark: (_bookId, bookmark) => saved.push(bookmark), onMoved });
	expect(saved).toEqual([]);
	expect(selection.sync(page)).toBe(true);
	return { selection, saved, onMoved };
}

const text = 'Кот спит на диване. Мышь бежит, а кот смотрит.';
const index = (selection: Selection, word: string) => selection.words.findIndex((w) => w.text === word);

describe('Selection', () => {
	it('resumes at the Bookmark’s Word on the bookmarked Page', async () => {
		const { db, bookId, page } = await setup('ru', text);
		await setBookmark(db, bookId, { page: 1, sentence: 2, word: 'бежит' });
		const { selection, saved, onMoved } = open(await page());
		expect(selection.selected?.text).toBe('бежит');
		expect(onMoved).toHaveBeenCalledWith(index(selection, 'бежит'), 'resume');
		// Saved again even though unchanged, so this Book is where you are now.
		expect(saved).toEqual([{ page: 1, sentence: 2, word: 'бежит' }]);
	});

	it('starts with no cursor at the start of a Page', async () => {
		const { page } = await setup('ru', text);
		const { selection, saved } = open(await page());
		expect(selection.cursor).toBeUndefined();
		expect(saved).toEqual([{ page: 1, sentence: 1 }]);
	});

	it('moves the Bookmark as it moves, once per change', async () => {
		const { page } = await setup('ru', text);
		const { selection, saved } = open(await page());
		selection.moveTo(index(selection, 'спит'));
		selection.moveTo(index(selection, 'спит'));
		selection.move({ kind: 'sentence', by: 1 });
		expect(saved.slice(1)).toEqual([
			{ page: 1, sentence: 1, word: 'спит' },
			{ page: 1, sentence: 2, word: 'Мышь' }
		]);
	});

	it('grows a phrase within a Sentence, and says why it can’t across punctuation or Sentences', async () => {
		const { page } = await setup('ru', text);
		const { selection, saved } = open(await page());
		selection.moveTo(index(selection, 'на'));
		expect(selection.move({ kind: 'extend', by: 1 })).toBeUndefined();
		expect(selection.selected).toMatchObject({ text: 'на диване', key: 'на диване' });
		expect(selection.inPhrase(index(selection, 'на'))).toBe(true);
		expect(saved.at(-1)).toEqual({ page: 1, sentence: 1, word: 'на диване' });
		expect(selection.move({ kind: 'extend', by: 1 })).toMatch(/inside one Sentence/);
		selection.moveTo(index(selection, 'бежит'));
		expect(selection.choose(index(selection, 'а'), true).error).toMatch(/no punctuation/);
		expect(selection.selected?.text).toBe('бежит');
	});

	it('says when a tap is on the selected Word again', async () => {
		const { page } = await setup('ru', text);
		const { selection } = open(await page());
		expect(selection.choose(index(selection, 'Кот'), false).again).toBe(false);
		expect(selection.choose(index(selection, 'Кот'), false).again).toBe(true);
	});

	it('collapses a phrase to its start when its Words regroup into a Multi-word Term', async () => {
		const { db, language, page } = await setup('ru', text);
		const { selection } = open(await page());
		// Selected backwards, so a stale anchor would point past the regrouped Words.
		selection.moveTo(index(selection, 'диване'));
		selection.move({ kind: 'extend', by: -1 });
		await saveTerm(db, { languageId: language.id, text: 'на диване', status: 'learning1', translations: [] });
		expect(selection.sync(await page())).toBe(false);
		expect(selection.selected?.text).toBe('на диване');
		expect(selection.inPhrase(selection.cursor!)).toBe(false);
	});

	it('resumes afresh on another Page', async () => {
		const { page } = await setup('ru', text);
		const first = await page();
		const { selection } = open(first);
		selection.moveTo(index(selection, 'спит'));
		expect(selection.sync({ ...first, position: 2, book: { ...first.book, bookmark: { page: 1, sentence: 1 } } })).toBe(true);
		expect(selection.cursor).toBeUndefined();
	});

	it('picks characters within a Chinese Word, and goes back to the whole Word', async () => {
		const { page } = await setup('zh', '我的书很好。');
		const { selection, saved } = open(await page());
		const word = selection.words.findIndex((w) => [...w.text].length > 1);
		selection.moveTo(word);
		const whole = selection.selected!.text;
		expect(selection.characters).toEqual([...whole]);
		selection.pickCharacter(0, false);
		expect(selection.selected).toMatchObject({ text: whole[0], key: whole[0] });
		expect(saved.at(-1)).toMatchObject({ word: whole[0] });
		selection.wholeWord();
		expect(selection.selected?.text).toBe(whole);
	});
});
