import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { createBook, getPage } from './books';
import { findTerms, saveTerm } from './terms';
import {
	clearHighlight,
	getBookmark,
	getHighlight,
	InvalidBookmark,
	InvalidHighlight,
	latestBookmark,
	markPageRead,
	setBookmark,
	setHighlight
} from './reading';

async function setup(text = 'Кот спит. Мышь бежит.\n---\nКот и мышь. Мышь спит.') {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const byName = Object.fromEntries((await listLanguages(db)).map((l) => [l.name, l.id]));
	const bookId = await createBook(db, { languageId: byName.Russian, title: 'Кот', text });
	return { db, byName, bookId };
}

const statuses = (page: Awaited<ReturnType<typeof getPage>>) =>
	page!.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.flatMap((t) => (t.key ? [[t.text, page!.terms[t.key]?.status ?? 'unknown']] : []))));

describe('Bookmark', () => {
	it('starts at the first Sentence of the first Page', async () => {
		const { db, bookId } = await setup();
		expect(await getBookmark(db, bookId)).toEqual({ page: 1, sentence: 1 });
		expect((await getPage(db, bookId, 1))?.book.bookmark).toEqual({ page: 1, sentence: 1 });
	});

	it('moves to a Page and Sentence, clamping the Sentence to the Page', async () => {
		const { db, bookId } = await setup();
		expect(await setBookmark(db, bookId, { page: 2, sentence: 2 })).toEqual({ page: 2, sentence: 2 });
		expect(await getBookmark(db, bookId)).toEqual({ page: 2, sentence: 2 });
		expect(await setBookmark(db, bookId, { page: 1, sentence: 9 })).toEqual({ page: 1, sentence: 2 });
		expect(await setBookmark(db, bookId, { page: 1, sentence: 0 })).toEqual({ page: 1, sentence: 1 });
	});

	it('rejects a Page the Book does not have', async () => {
		const { db, bookId } = await setup();
		await expect(setBookmark(db, bookId, { page: 3, sentence: 1 })).rejects.toThrow(InvalidBookmark);
		expect(await getBookmark(db, bookId)).toEqual({ page: 1, sentence: 1 });
	});
});

describe('markPageRead', () => {
	it('marks the Page Read and moves the Bookmark to the next Page', async () => {
		const { db, bookId } = await setup();
		await setBookmark(db, bookId, { page: 1, sentence: 2 });
		expect(await markPageRead(db, bookId, 1)).toBe(2);
		expect((await getPage(db, bookId, 1))?.read).toBe(true);
		expect((await getPage(db, bookId, 2))?.read).toBe(false);
		expect(await getBookmark(db, bookId)).toEqual({ page: 2, sentence: 1 });
		expect(await db.selectFrom('term').select('id').execute()).toHaveLength(0);
	});

	it('keeps the Bookmark on the last Page', async () => {
		const { db, bookId } = await setup();
		await setBookmark(db, bookId, { page: 2, sentence: 2 });
		expect(await markPageRead(db, bookId, 2)).toBeUndefined();
		expect(await getBookmark(db, bookId)).toEqual({ page: 2, sentence: 2 });
	});

	it('with rest Known, makes only the Unknown Words Known, and the next Page shows them', async () => {
		const { db, byName, bookId } = await setup();
		await saveTerm(db, { languageId: byName.Russian, text: 'спит', status: 'learning2' });
		await markPageRead(db, bookId, 1, { restKnown: true });
		expect(statuses(await getPage(db, bookId, 2))).toEqual([
			['Кот', 'known'],
			['и', 'unknown'],
			['мышь', 'known'],
			['Мышь', 'known'],
			['спит', 'learning2']
		]);
		expect((await findTerms(db, byName.Russian, ['кот'])).кот.text).toBe('кот');
	});

	it('gives Chinese Words made Known their pinyin', async () => {
		const { db, byName } = await setup();
		const bookId = await createBook(db, { languageId: byName.Chinese, title: '今天', text: '我喜欢猫。' });
		await markPageRead(db, bookId, 1, { restKnown: true });
		expect((await findTerms(db, byName.Chinese, ['喜欢'])).喜欢).toMatchObject({ status: 'known', pronunciation: 'xǐhuan' });
	});

	it('rejects a Page the Book does not have', async () => {
		const { db, bookId } = await setup();
		await expect(markPageRead(db, bookId, 5)).rejects.toThrow(InvalidBookmark);
	});
});

describe('markPageRead with Multi-word Terms', () => {
	it('with rest Known, skips Words inside a Multi-word Term', async () => {
		const { db, byName } = await setup();
		const bookId = await createBook(db, { languageId: byName.Russian, title: 't', text: 'В течение дня кот спит.' });
		await saveTerm(db, { languageId: byName.Russian, text: 'в течение', status: 'learning2' });
		await markPageRead(db, bookId, 1, { restKnown: true });
		const known = await findTerms(db, byName.Russian, ['в', 'течение', 'дня', 'кот', 'спит']);
		expect(Object.keys(known).toSorted()).toEqual(['дня', 'кот', 'спит']);
	});
});

describe('the Bookmark Word', () => {
	it('records the Word or phrase selected in the Sentence, in any spacing or case', async () => {
		const { db, bookId } = await setup();
		expect(await setBookmark(db, bookId, { page: 2, sentence: 2, word: ' спит ' })).toEqual({ page: 2, sentence: 2, word: 'спит' });
		expect(await getBookmark(db, bookId)).toEqual({ page: 2, sentence: 2, word: 'спит' });
		expect(await setBookmark(db, bookId, { page: 1, sentence: 1, word: 'КОТ  спит' })).toMatchObject({ word: 'КОТ спит' });
		expect(await setBookmark(db, bookId, { page: 1, sentence: 2 })).toEqual({ page: 1, sentence: 2 });
		expect(await getBookmark(db, bookId)).toEqual({ page: 1, sentence: 2 });
	});

	it('refuses a Word that is not in the Sentence', async () => {
		const { db, bookId } = await setup();
		await expect(setBookmark(db, bookId, { page: 1, sentence: 1, word: 'Мышь' })).rejects.toThrow('“Мышь” isn\'t in Sentence 1 of Page 1.');
	});

	it('is cleared when the Page is marked Read', async () => {
		const { db, bookId } = await setup();
		await setBookmark(db, bookId, { page: 1, sentence: 2, word: 'бежит' });
		await markPageRead(db, bookId, 1);
		expect(await getBookmark(db, bookId)).toEqual({ page: 2, sentence: 1 });
	});
});

describe('latestBookmark', () => {
	it('is the Bookmark moved most recently, in any Book', async () => {
		const { db, byName, bookId } = await setup();
		expect(await latestBookmark(db)).toBeUndefined();
		const other = await createBook(db, { languageId: byName.Russian, title: 'Другая', text: 'Раз. Два.' });
		await setBookmark(db, bookId, { page: 1, sentence: 2 });
		await new Promise((r) => setTimeout(r, 5));
		await setBookmark(db, other, { page: 1, sentence: 2, word: 'Два' });
		expect(await latestBookmark(db)).toMatchObject({ bookId: other, title: 'Другая', bookmark: { page: 1, sentence: 2, word: 'Два' } });
		await new Promise((r) => setTimeout(r, 5));
		await markPageRead(db, bookId, 1);
		expect(await latestBookmark(db)).toMatchObject({ bookId, bookmark: { page: 2, sentence: 1 } });
	});
});

describe('Highlight', () => {
	it('is set on a run of Sentences with a note, replacing the last one', async () => {
		const { db, bookId } = await setup();
		expect(await getHighlight(db, bookId)).toBeUndefined();
		await setHighlight(db, bookId, { page: 1, first: 1, last: 1 });
		const set = await setHighlight(db, bookId, { page: 2, first: 1, last: 2, note: '  Who is  asleep? ' });
		expect(set).toMatchObject({ page: 2, first: 1, last: 2, note: 'Who is asleep?' });
		expect(await getHighlight(db, bookId)).toEqual(set);
	});

	it('leaves the Bookmark where it is', async () => {
		const { db, bookId } = await setup();
		await setBookmark(db, bookId, { page: 1, sentence: 2, word: 'Мышь' });
		await setHighlight(db, bookId, { page: 2, first: 1, last: 1 });
		expect(await getBookmark(db, bookId)).toEqual({ page: 1, sentence: 2, word: 'Мышь' });
	});

	it('rejects Sentences that are not on the Page, out of order, or a Page the Book lacks', async () => {
		const { db, bookId } = await setup();
		await expect(setHighlight(db, bookId, { page: 1, first: 1, last: 3 })).rejects.toThrow(InvalidHighlight);
		await expect(setHighlight(db, bookId, { page: 1, first: 2, last: 1 })).rejects.toThrow(InvalidHighlight);
		await expect(setHighlight(db, bookId, { page: 1, first: 0, last: 1 })).rejects.toThrow(InvalidHighlight);
		await expect(setHighlight(db, bookId, { page: 3, first: 1, last: 1 })).rejects.toThrow(InvalidHighlight);
		await expect(setHighlight(db, bookId, { page: 1, first: 1, last: 1, note: 'x'.repeat(301) })).rejects.toThrow(InvalidHighlight);
		expect(await getHighlight(db, bookId)).toBeUndefined();
	});

	it('is cleared by the Tutor, or by marking its Page Read', async () => {
		const { db, bookId } = await setup();
		await setHighlight(db, bookId, { page: 1, first: 1, last: 2 });
		await clearHighlight(db, bookId);
		expect(await getHighlight(db, bookId)).toBeUndefined();

		await setHighlight(db, bookId, { page: 2, first: 1, last: 1 });
		await markPageRead(db, bookId, 1);
		expect(await getHighlight(db, bookId)).toMatchObject({ page: 2 });
		await markPageRead(db, bookId, 2);
		expect(await getHighlight(db, bookId)).toBeUndefined();
	});
});
