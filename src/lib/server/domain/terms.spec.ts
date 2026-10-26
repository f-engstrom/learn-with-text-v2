import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { createBook, getPage } from './books';
import { deleteTerm, findTerms, InvalidTerm, saveTerm } from './terms';

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const byName = Object.fromEntries((await listLanguages(db)).map((l) => [l.name, l.id]));
	return { db, byName };
}

describe('saveTerm', () => {
	it('creates a Term with its Translation', async () => {
		const { db, byName } = await setup();
		const id = await saveTerm(db, { languageId: byName.Russian, text: 'Чита́ть', status: 'learning2', translation: ' to read ' });
		expect(await findTerms(db, byName.Russian, ['читать'])).toEqual({
			читать: { id, text: 'чита́ть', status: 'learning2', translation: 'to read' }
		});
	});

	it('updates the Term with the same Normalised form instead of adding one', async () => {
		const { db, byName } = await setup();
		const first = await saveTerm(db, { languageId: byName.Russian, text: 'читать', status: 'learning1', translation: 'read' });
		const second = await saveTerm(db, { languageId: byName.Russian, text: 'ЧИТА́ТЬ', status: 'known', translation: '' });
		expect(second).toBe(first);
		expect(await findTerms(db, byName.Russian, ['читать'])).toEqual({
			читать: { id: first, text: 'читать', status: 'known', translation: '' }
		});
		expect(await db.selectFrom('term').select('id').execute()).toHaveLength(1);
	});

	it('keeps Terms apart per Language', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Bosnian, text: 'da', status: 'known', translation: '' });
		expect(await findTerms(db, byName.Russian, ['da'])).toEqual({});
	});

	it('matches Farsi Words spelled with Arabic letters', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Farsi, text: 'كتاب', status: 'learning1', translation: 'book' });
		const terms = await findTerms(db, byName.Farsi, ['کتاب']);
		expect(terms['کتاب']?.translation).toBe('book');
	});

	it.each([
		[{ status: 'learning5' }, 'Status'],
		[{ text: '  ' }, 'text'],
		[{ languageId: 999 }, 'Language']
	])('rejects %o', async (override, message) => {
		const { db, byName } = await setup();
		const input = { languageId: byName.Russian, text: 'кот', status: 'learning1', translation: '', ...override };
		await expect(saveTerm(db, input)).rejects.toThrow(InvalidTerm);
		await expect(saveTerm(db, input)).rejects.toThrow(message);
	});
});

describe('deleteTerm', () => {
	it('removes the Term and its Translations', async () => {
		const { db, byName } = await setup();
		const id = await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1', translation: 'cat' });
		await deleteTerm(db, id);
		expect(await findTerms(db, byName.Russian, ['кот'])).toEqual({});
		expect(await db.selectFrom('translation').select('id').execute()).toEqual([]);
	});
});

describe('getPage with Terms', () => {
	it('gives every Word its Normalised form and returns the matching Terms', async () => {
		const { db, byName } = await setup();
		const bookId = await createBook(db, { languageId: byName.Russian, title: 'Кот', text: 'Кот чита́ет. Кот спит.' });
		const termId = await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning3', translation: 'cat' });

		const page = await getPage(db, bookId, 1);
		const words = page!.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t) => t.isWord)));
		expect(words.map((w) => w.key)).toEqual(['кот', 'читает', 'кот', 'спит']);
		expect(page!.terms).toEqual({ кот: { id: termId, text: 'кот', status: 'learning3', translation: 'cat' } });
	});
});
