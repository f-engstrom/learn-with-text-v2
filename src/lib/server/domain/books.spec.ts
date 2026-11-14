import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { createBook, editBook, getBook, getPage, InvalidBook, listBooks, MAX_FILE_BYTES, splitIntoPages, textFromFile } from './books';
import { markPageRead, setBookmark } from './reading';
import { saveTerm } from './terms';
import { parserFor } from './parsing';

const bosnian = parserFor({ code: 'bs' });

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const byName = Object.fromEntries((await listLanguages(db)).map((l) => [l.name, l.id]));
	return { db, byName };
}

describe('splitIntoPages', () => {
	it('keeps a short text on one Page with its paragraphs', () => {
		expect(splitIntoPages('Prvi red.\n\nDrugi red.', bosnian)).toEqual(['Prvi red.\nDrugi red.']);
	});

	it('starts a new Page at a line containing only ---', () => {
		expect(splitIntoPages('Jedan.\n---\nDva.\n  ---  \nTri.', bosnian)).toEqual(['Jedan.', 'Dva.', 'Tri.']);
	});

	it('ends a Page at the first Sentence boundary after the Word target', () => {
		const pages = splitIntoPages('Jedan dva tri. Četiri pet. Šest.', bosnian, 4);
		expect(pages).toEqual(['Jedan dva tri. Četiri pet.', 'Šest.']);
	});

	it('continues a long paragraph on the next Page', () => {
		const pages = splitIntoPages('A b. C d. E f.\nG h.', bosnian, 2);
		expect(pages).toEqual(['A b.', 'C d.', 'E f.', 'G h.']);
	});

	it('drops empty Pages', () => {
		expect(splitIntoPages('---\nJedan.\n---\n\n---', bosnian)).toEqual(['Jedan.']);
	});
});

describe('createBook', () => {
	it('stores Pages and Sentences and reads the first Page back', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Russian, title: ' Сказка ', text: 'Жил-был кот. Он спал.\n---\nКонец.' });

		const page = await getPage(db, id, 1);
		expect(page?.book).toEqual({ id, title: 'Сказка', pageCount: 2, bookmark: { page: 1, sentence: 1 } });
	expect(page?.read).toBe(false);
		expect(page?.language.name).toBe('Russian');
		expect(page?.paragraphs[0].sentences).toHaveLength(2);

		const sentences = await db.selectFrom('sentence').select(['position', 'text']).orderBy('id').execute();
		expect(sentences).toEqual([
			{ position: 1, text: 'Жил-был кот. ' },
			{ position: 2, text: 'Он спал.' },
			{ position: 1, text: 'Конец.' }
		]);
		expect(await listBooks(db)).toEqual([
			{ id, title: 'Сказка', languageName: 'Russian', pageCount: 2, readCount: 0, bookmark: { page: 1, sentence: 1 }, unknownShare: 1 }
		]);
	});

	it('loads the Terms for characters within a Chinese Word', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Chinese, title: '书', text: '这是我的书。' });
		await saveTerm(db, { languageId: byName.Chinese, text: '我', status: 'known' });

		const page = await getPage(db, id, 1);
		expect(page?.paragraphs[0].sentences[0].tokens.map((t) => t.text)).toContain('我的');
		expect(page?.terms['我']?.status).toBe('known');
	});

	it('returns nothing for a Page that does not exist', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Bosnian, title: 'Knjiga', text: 'Jedan.' });
		expect(await getPage(db, id, 2)).toBeUndefined();
	});

	it.each([
		[{ title: '', text: 'Jedan.' }, 'title'],
		[{ title: 'Knjiga', text: '12. 3. 2024.' }, 'no Words'],
		[{ title: 'Knjiga', text: '   ' }, 'no Words']
	])('rejects %o', async (input, message) => {
		const { db, byName } = await setup();
		await expect(createBook(db, { languageId: byName.Bosnian, ...input })).rejects.toThrow(InvalidBook);
		await expect(createBook(db, { languageId: byName.Bosnian, ...input })).rejects.toThrow(message);
	});

	it('rejects an unknown Language', async () => {
		const { db } = await setup();
		await expect(createBook(db, { languageId: 999, title: 'X', text: 'Jedan.' })).rejects.toThrow(InvalidBook);
	});
});

describe('listBooks', () => {
	it("gives each Book's Unknown share of distinct Words, which drops as you mark them", async () => {
		const { db, byName } = await setup();
		// Distinct Words: кот, спит, и, мышь (Кот and кот are one; 2024 is not a Word).
		const id = await createBook(db, { languageId: byName.Russian, title: 'Кот', text: 'Кот спит. Кот и мышь спят в 2024.' });
		const share = async () => (await listBooks(db)).find((b) => b.id === id)!.unknownShare;
		const words = (await db.selectFrom('book_word').select('normalised').where('book_id', '=', id).execute()).map((w) => w.normalised);
		expect(words.toSorted()).toEqual(['в', 'и', 'кот', 'мышь', 'спит', 'спят'].toSorted());
		expect(await share()).toBe(1);
		await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1' });
		await saveTerm(db, { languageId: byName.Russian, text: 'и', status: 'ignored' });
		expect(await share()).toBeCloseTo(4 / 6);
		await saveTerm(db, { languageId: byName.Chinese, text: 'мышь', status: 'known' });
		expect(await share()).toBeCloseTo(4 / 6);
	});

	it('counts Read Pages and shows the Bookmark, newest Book first', async () => {
		const { db, byName } = await setup();
		await createBook(db, { languageId: byName.Bosnian, title: 'Prva', text: 'Jedan.' });
		const id = await createBook(db, { languageId: byName.Russian, title: 'Вторая', text: 'Раз.\n---\nДва.\n---\nТри.' });
		await markPageRead(db, id, 1, { restKnown: true });
		const [newest, oldest] = await listBooks(db);
		expect(newest).toMatchObject({ title: 'Вторая', pageCount: 3, readCount: 1, bookmark: { page: 2, sentence: 1 } });
		expect(newest.unknownShare).toBeCloseTo(2 / 3);
		expect(oldest.title).toBe('Prva');
	});
});

describe('textFromFile', () => {
	const bytes = (text: string) => new TextEncoder().encode(text);

	it('decodes UTF-8 and drops a byte-order mark', () => {
		expect(textFromFile(bytes('\uFEFFКот спит.'))).toBe('Кот спит.');
	});

	it('rejects text that is not UTF-8, and files that are too large', () => {
		expect(() => textFromFile(new Uint8Array([0xca, 0xee, 0xf2]))).toThrow(InvalidBook);
		expect(() => textFromFile(new Uint8Array(MAX_FILE_BYTES + 1))).toThrow('larger than 5 MB');
	});
});

describe('editBook', () => {
	const tale = 'Жил-был кот.';
	const edit = (more: { title?: string; languageId: number; text?: string }) => ({ title: 'Сказка', text: tale, ...more });

	it('gives the whole text back, a --- line between Pages', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Russian, title: 'Сказка', text: 'Жил-был кот.\n---\nКонец.' });
		expect(await getBook(db, id)).toEqual({ id, title: 'Сказка', languageId: byName.Russian, pageCount: 2, text: 'Жил-был кот.\n---\nКонец.' });
	});

	it('renames a Book', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Russian, title: 'Сказка', text: tale });
		await editBook(db, id, edit({ title: ' Кот ', languageId: byName.Russian }));
		expect((await getBook(db, id))?.title).toBe('Кот');
	});

	it('refuses an empty title or a text with no Words', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Russian, title: 'Сказка', text: tale });
		await expect(editBook(db, id, edit({ title: ' ', languageId: byName.Russian }))).rejects.toThrow(InvalidBook);
		await expect(editBook(db, id, edit({ text: '…', languageId: byName.Russian }))).rejects.toThrow(InvalidBook);
	});

	it('moves a Book to another Language, keeping Read Pages and the Bookmark on its Page', async () => {
		const { db, byName } = await setup();
		const text = 'Shkuam në park.\n---\nHëngrëm bukë. Pimë ujë. Ikëm.';
		const id = await createBook(db, { languageId: byName.Russian, title: 'Piknik', text });
		await markPageRead(db, id, 1);
		await setBookmark(db, id, { page: 2, sentence: 3 });
		await editBook(db, id, { title: 'Piknik', languageId: byName.Albanian, text });

		const page = await getPage(db, id, 2);
		expect(page?.language.name).toBe('Albanian');
		expect(page?.book.bookmark).toEqual({ page: 2, sentence: 3 });
		expect((await getPage(db, id, 1))?.read).toBe(true);
		const [book] = await listBooks(db);
		expect(book).toMatchObject({ languageName: 'Albanian', readCount: 1, unknownShare: 1 });
	});

	it('adds Pages to the end, with their Words, and unchanged Pages stay Read', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Russian, title: 'Сказка', text: tale });
		await markPageRead(db, id, 1);
		await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'known' });
		await editBook(db, id, edit({ languageId: byName.Russian, text: `${tale}\n---\nКот спал.\n---\nКонец.` }));

		const [book] = await listBooks(db);
		expect(book).toMatchObject({ pageCount: 3, readCount: 1 });
		// жил, был, спал, конец Unknown; кот Known.
		expect(book.unknownShare).toBeCloseTo(4 / 5);
	});

	it('keeps the Bookmark on the last Page when Pages are taken away', async () => {
		const { db, byName } = await setup();
		const id = await createBook(db, { languageId: byName.Russian, title: 'Сказка', text: 'Раз. Два.\n---\nТри.' });
		await setBookmark(db, id, { page: 2, sentence: 1, word: 'Три' });
		await editBook(db, id, edit({ languageId: byName.Russian, text: 'Раз. Два.' }));
		expect((await getPage(db, id, 1))?.book.bookmark).toEqual({ page: 1, sentence: 1 });
	});
});
