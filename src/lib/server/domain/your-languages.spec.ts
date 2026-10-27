import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { InvalidYourLanguage, listYourLanguages, removeYourLanguage, setYourLanguage } from './your-languages';

describe('Your languages', () => {
	it('adds, updates in any case, lists native first, and removes', async () => {
		const db = openDatabase(':memory:');
		await migrateToLatest(db);
		await setYourLanguage(db, { name: 'English', level: 'fluent' });
		await setYourLanguage(db, { name: ' Swedish ', level: 'native' });
		await setYourLanguage(db, { name: 'german', level: 'some' });
		expect(await setYourLanguage(db, { name: 'ENGLISH', level: 'native' })).toEqual({ name: 'English', level: 'native' });
		expect(await listYourLanguages(db)).toEqual([
			{ name: 'English', level: 'native' },
			{ name: 'Swedish', level: 'native' },
			{ name: 'german', level: 'some' }
		]);
		await removeYourLanguage(db, 'German');
		expect((await listYourLanguages(db)).map((l) => l.name)).toEqual(['English', 'Swedish']);
		await expect(setYourLanguage(db, { name: 'French', level: 'good' })).rejects.toThrow(InvalidYourLanguage);
	});
});
