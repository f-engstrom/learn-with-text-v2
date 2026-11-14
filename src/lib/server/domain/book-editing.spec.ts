import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { editBook, editPagesAsTutor, getBookForEditing, listPages, ReadPageRefused, type PageEdit } from './book-editing';
import { createBook, getPage, InvalidBook, listBooks } from './books';
import { listLanguages } from './languages';
import { getHighlight, markPageRead, setBookmark, setHighlight } from './reading';
import { saveTerm } from './terms';

async function setup(text = 'Раз. Два.\n---\nТри.\n---\nЧетыре.') {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const byName = Object.fromEntries((await listLanguages(db)).map((l) => [l.name, l.id]));
	const id = await createBook(db, { languageId: byName.Russian, title: 'Сказка', text });
	const pages = await listPages(db, id);
	/** The Book's edit with these Pages, its title and Language as they are. */
	const edit = (edits: PageEdit[], more: { title?: string; languageId?: number; url?: string } = {}) =>
		editBook(db, id, { title: 'Сказка', languageId: byName.Russian, pages: edits, ...more });
	const keep = (i: number, text = pages[i].text): PageEdit => ({ id: pages[i].id, text });
	const texts = async () => (await listPages(db, id)).map((p) => p.text);
	return { db, byName, id, pages, edit, keep, texts };
}

describe('getBookForEditing', () => {
	it('gives the Pages with their ids, Read marks and Words, and the Page the Bookmark is on', async () => {
		const { db, id, pages } = await setup();
		await markPageRead(db, id, 1, { now: new Date('2026-11-10T10:00:00Z') });
		await setBookmark(db, id, { page: 2, sentence: 1 });
		const book = await getBookForEditing(db, id);
		expect(book).toMatchObject({ id, title: 'Сказка', bookmarkPageId: pages[1].id });
		expect(book?.pages[0]).toEqual({ id: pages[0].id, position: 1, text: 'Раз. Два.', readAt: '2026-11-10T10:00:00.000Z', words: 2 });
	});
});

describe('editBook', () => {
	it('renames a Book and sets its web address', async () => {
		const { db, id, edit, keep } = await setup();
		await edit([keep(0), keep(1), keep(2)], { title: ' Кот ', url: ' https://example.org/a ' });
		expect(await getBookForEditing(db, id)).toMatchObject({ title: 'Кот', url: 'https://example.org/a' });
	});

	it('refuses an empty title, a text with no Words, a Page emptied or one from another Book', async () => {
		const { edit, keep } = await setup();
		await expect(edit([keep(0)], { title: ' ' })).rejects.toThrow(InvalidBook);
		await expect(edit([{ id: null, text: '…' }])).rejects.toThrow('no Words');
		await expect(edit([keep(0, '  ')])).rejects.toThrow('Page 1 has no text');
		await expect(edit([keep(0), { id: 9999, text: 'Пять.' }])).rejects.toThrow(InvalidBook);
		await expect(edit([keep(0), keep(0)])).rejects.toThrow(InvalidBook);
	});

	it('refuses a web address that isn’t http(s) or is another Book’s', async () => {
		const { db, byName, edit, keep } = await setup();
		await createBook(db, { languageId: byName.Russian, title: 'Другая', text: 'Пять.', url: 'https://example.org/b' });
		await expect(edit([keep(0)], { url: 'example.org' })).rejects.toThrow('isn’t one');
		await expect(edit([keep(0)], { url: 'ftp://example.org/a' })).rejects.toThrow('http');
		await expect(edit([keep(0)], { url: 'https://example.org/b' })).rejects.toThrow('Another Book');
	});

	it('moves Pages, each keeping its Read mark, and the Bookmark goes with its Page', async () => {
		const { db, id, pages, edit, keep, texts } = await setup();
		await markPageRead(db, id, 1);
		await setBookmark(db, id, { page: 2, sentence: 1, word: 'Три' });
		await edit([keep(1), keep(2), keep(0)]);

		expect(await texts()).toEqual(['Три.', 'Четыре.', 'Раз. Два.']);
		expect((await getPage(db, id, 3))?.read).toBe(true);
		expect((await getPage(db, id, 1))?.book.bookmark).toEqual({ page: 1, sentence: 1, word: 'Три' });
		expect((await listPages(db, id)).map((p) => p.id)).toEqual([pages[1].id, pages[2].id, pages[0].id]);
	});

	it('keeps a Read Page Read when its text changes, counting its Words again', async () => {
		const { db, id, edit, keep } = await setup();
		await markPageRead(db, id, 1);
		await edit([keep(0, 'Раз. Два. Три кота.'), keep(1), keep(2)]);
		const [first] = await listPages(db, id);
		expect(first).toMatchObject({ words: 4 });
		expect(first.readAt).not.toBeNull();
		expect(await db.selectFrom('sentence').select('text').where('page_id', '=', first.id).execute()).toHaveLength(3);
	});

	it('splits a Page at a --- line: the first part keeps it, the rest are new and Read if it was', async () => {
		const { db, id, pages, edit, keep, texts } = await setup();
		await markPageRead(db, id, 1);
		await edit([keep(0, 'Раз.\n---\nДва.'), keep(1), keep(2)]);
		const after = await listPages(db, id);
		expect(await texts()).toEqual(['Раз.', 'Два.', 'Три.', 'Четыре.']);
		expect(after[0].id).toBe(pages[0].id);
		expect(after[1].readAt).toBe(after[0].readAt);
	});

	it('adds new Pages anywhere, with their Words', async () => {
		const { db, byName, id, edit, keep, texts } = await setup();
		await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'known' });
		await edit([keep(0), { id: null, text: 'Кот спал.' }, keep(1), keep(2), { id: null, text: '' }]);
		expect(await texts()).toEqual(['Раз. Два.', 'Кот спал.', 'Три.', 'Четыре.']);
		const [book] = await listBooks(db);
		// раз, два, спал, три, четыре Unknown; кот Known.
		expect(book.unknownShare).toBeCloseTo(5 / 6);
	});

	it('takes away a Read mark, but marks nothing Read', async () => {
		const { db, id, edit, pages } = await setup();
		await markPageRead(db, id, 1);
		await edit([
			{ id: pages[0].id, text: pages[0].text, read: false },
			{ id: pages[1].id, text: pages[1].text, read: true },
			{ id: pages[2].id, text: pages[2].text }
		]);
		expect((await listPages(db, id)).map((p) => p.readAt)).toEqual([null, null, null]);
	});

	it('moves the Bookmark from a removed Page to the next kept one, and from the last to the new last', async () => {
		const { db, id, edit, keep } = await setup();
		await setBookmark(db, id, { page: 2, sentence: 1, word: 'Три' });
		await edit([keep(0), keep(2)]);
		expect((await getPage(db, id, 2))?.book.bookmark).toEqual({ page: 2, sentence: 1 });

		await setBookmark(db, id, { page: 2, sentence: 1 });
		await edit([keep(0)]);
		expect((await getPage(db, id, 1))?.book.bookmark).toEqual({ page: 1, sentence: 1 });
	});

	it('keeps the Bookmark’s Sentence on a changed Page where it can, forgetting its Word', async () => {
		const { db, id, edit, keep } = await setup();
		await setBookmark(db, id, { page: 1, sentence: 2, word: 'Два' });
		await edit([keep(0, 'Раз. Два. Три.'), keep(1), keep(2)]);
		expect((await getPage(db, id, 1))?.book.bookmark).toEqual({ page: 1, sentence: 2 });
		await edit([keep(0, 'Раз.'), keep(1), keep(2)]);
		expect((await getPage(db, id, 1))?.book.bookmark).toEqual({ page: 1, sentence: 1 });
	});

	it('keeps the Highlight with its unchanged Page, and clears it when that Page changes', async () => {
		const { db, id, edit, keep } = await setup();
		await setHighlight(db, id, { page: 3, first: 1, last: 1 });
		await edit([keep(2), keep(0), keep(1)]);
		expect(await getHighlight(db, id)).toMatchObject({ page: 1, first: 1, last: 1 });
		await edit([keep(2, 'Пять.'), keep(0), keep(1)]);
		expect(await getHighlight(db, id)).toBeUndefined();
	});

	it('moves a Book to another Language, keeping Read marks and splitting its Pages by that Language’s rules', async () => {
		const { db, byName, id, edit, keep } = await setup('Shkuam në park.\n---\nHëngrëm bukë. Pimë ujë. Ikëm.');
		await markPageRead(db, id, 1);
		await setBookmark(db, id, { page: 2, sentence: 3 });
		await edit([keep(0), keep(1)], { title: 'Piknik', languageId: byName.Albanian });

		const page = await getPage(db, id, 2);
		expect(page?.language.name).toBe('Albanian');
		expect(page?.book.bookmark).toEqual({ page: 2, sentence: 3 });
		expect(await getHighlight(db, id)).toBeUndefined();
		const [book] = await listBooks(db);
		expect(book).toMatchObject({ languageName: 'Albanian', readCount: 1, unknownShare: 1 });
	});
});

describe('editPagesAsTutor', () => {
	const messy = 'Главная | Новости | Войти\n---\nВечером играли до\n---\nпоздней ночи.\n---\n© 2026 Новости';

	it('removes, joins, moves and adds Pages and renames the Book, in one save', async () => {
		const { db, id, pages, texts } = await setup(messy);
		await editPagesAsTutor(db, id, {
			title: 'Вечер',
			operations: [
				{ op: 'remove', page: pages[0].id },
				{ op: 'remove', page: pages[3].id },
				{ op: 'join_next', page: pages[1].id },
				{ op: 'add', after: null, text: 'Начало.' },
				{ op: 'move', page: pages[1].id, after: null }
			]
		});
		expect(await texts()).toEqual(['Вечером играли до поздней ночи.', 'Начало.']);
		expect((await getBookForEditing(db, id))?.title).toBe('Вечер');
	});

	it('leaves Read Pages alone', async () => {
		const { db, id, pages } = await setup(messy);
		await markPageRead(db, id, 2);
		for (const operation of [
			{ op: 'set_text', page: pages[1].id, text: 'Иначе.' },
			{ op: 'remove', page: pages[1].id },
			{ op: 'join_next', page: pages[0].id },
			{ op: 'move', page: pages[1].id, after: null }
		] as const) {
			await expect(editPagesAsTutor(db, id, { operations: [operation] })).rejects.toThrow(ReadPageRefused);
		}
		await editPagesAsTutor(db, id, { operations: [{ op: 'add', after: pages[1].id, text: 'После.' }] });
		expect((await listPages(db, id))[2].text).toBe('После.');
	});

	it('refuses a Page that is not there any more', async () => {
		const { db, id, pages } = await setup(messy);
		await expect(
			editPagesAsTutor(db, id, {
				operations: [
					{ op: 'remove', page: pages[0].id },
					{ op: 'set_text', page: pages[0].id, text: 'Нет.' }
				]
			})
		).rejects.toThrow('get_pages');
	});
});
