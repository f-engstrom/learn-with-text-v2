import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { frequencyBands, useFrequencyLists } from './frequency';
import { findTerms, listTerms, saveTerm } from './terms';
import { createBook, getPage } from './books';

const lists = mkdtempSync(join(tmpdir(), 'frequency-'));
// 1,200 filler words put "кот" at rank 1 and "дом" past the first thousand.
writeFileSync(join(lists, 'ru.txt'), ['Кот', ',', 'Ко́т', ...Array.from({ length: 1200 }, (_, i) => `слово${i}`), 'дом'].join('\n'));

async function setup() {
	useFrequencyLists(lists);
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const languages = await listLanguages(db);
	return { db, russian: languages.find((l) => l.code === 'ru')!, chinese: languages.find((l) => l.code === 'zh')! };
}

afterAll(() => useFrequencyLists('resources/frequency'));

describe('frequencyBands', () => {
	it('bands Words by rank in the list, by Normalised form, skipping punctuation', async () => {
		const { db, russian } = await setup();
		expect(await frequencyBands(db, russian, ['кот', 'дом', 'волк', 'в течение'])).toEqual({ кот: 'top1k', дом: 'top5k', волк: 'rare' });
	});

	it('gives nothing for a Language without a list', async () => {
		const { db, chinese } = await setup();
		expect(await frequencyBands(db, chinese, ['我'])).toEqual({});
	});

	it('reaches Terms and Pages', async () => {
		const { db, russian } = await setup();
		await saveTerm(db, { languageId: russian.id, text: 'дом', status: 'learning1' });
		expect((await findTerms(db, russian.id, ['дом'])).дом.frequency).toBe('top5k');
		const book = await createBook(db, { languageId: russian.id, title: 'Кот', text: 'Кот и дом.' });
		expect((await getPage(db, book, 1))!.frequency).toMatchObject({ кот: 'top1k', и: 'rare', дом: 'top5k' });
	});

	it('filters the Term list by band, leaving phrases out', async () => {
		const { db, russian } = await setup();
		for (const text of ['кот', 'дом', 'волк', 'в течение']) await saveTerm(db, { languageId: russian.id, text, status: 'learning1' });
		const by = async (frequency: 'top1k' | 'top5k' | 'rare') => (await listTerms(db, { frequency })).terms.map((t) => t.text);
		expect(await by('top1k')).toEqual(['кот']);
		expect(await by('top5k')).toEqual(['дом']);
		expect(await by('rare')).toEqual(['волк']);
	});
});
