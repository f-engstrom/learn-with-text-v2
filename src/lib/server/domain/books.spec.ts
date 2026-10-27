import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { createBook, getPage, InvalidBook, listBooks, splitIntoPages } from './books';
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
		expect(await listBooks(db)).toEqual([{ id, title: 'Сказка', languageName: 'Russian' }]);
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
