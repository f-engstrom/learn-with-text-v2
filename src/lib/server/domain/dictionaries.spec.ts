import { describe, it, expect } from 'vitest';
import { lookupUrl } from '../../dictionaries';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { listDictionaries } from './dictionaries';

describe('Dictionaries', () => {
	it('are seeded for every Language, in order, each with a [TERM] placeholder', async () => {
		const db = openDatabase(':memory:');
		await migrateToLatest(db);
		for (const language of await listLanguages(db)) {
			const dictionaries = await listDictionaries(db, language.id);
			expect(dictionaries.length, language.name).toBeGreaterThan(0);
			expect(dictionaries[0].display, language.name).toBe('embedded');
			for (const d of dictionaries) expect(d.url).toContain('[TERM]');
		}
		const russian = (await listLanguages(db)).find((l) => l.code === 'ru')!;
		expect((await listDictionaries(db, russian.id)).map((d) => d.name)).toEqual(['Wiktionary', 'OpenRussian', 'Google Translate']);
	});

	it('look up a Term by its encoded Normalised form', () => {
		expect(lookupUrl({ url: 'https://example.org/wiki/[TERM]#Russian' }, 'в течение')).toBe(
			'https://example.org/wiki/%D0%B2%20%D1%82%D0%B5%D1%87%D0%B5%D0%BD%D0%B8%D0%B5#Russian'
		);
		expect(lookupUrl({ url: 'https://example.org/?q=[TERM]&again=[TERM]' }, '喜欢')).toBe(
			'https://example.org/?q=%E5%96%9C%E6%AC%A2&again=%E5%96%9C%E6%AC%A2'
		);
	});
});
