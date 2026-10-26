import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';

async function freshDatabase() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	return db;
}

describe('listLanguages', () => {
	it('lists the four seeded Languages by name', async () => {
		const languages = await listLanguages(await freshDatabase());
		expect(languages.map((l) => l.name)).toEqual(['Bosnian', 'Chinese', 'Farsi', 'Russian']);
	});

	it('marks only Farsi as right to left', async () => {
		const languages = await listLanguages(await freshDatabase());
		expect(languages.filter((l) => l.rightToLeft).map((l) => l.name)).toEqual(['Farsi']);
	});

	it('seeds the normalisation rules', async () => {
		const byName = Object.fromEntries((await listLanguages(await freshDatabase())).map((l) => [l.name, l]));
		expect(byName.Russian.characterMap).toEqual({ '́': '', '̀': '' });
		expect(byName.Farsi.characterMap).toEqual({ 'ي': 'ی', 'ك': 'ک' });
	});
});

describe('migrateToLatest', () => {
	it('can run twice without seeding again', async () => {
		const db = await freshDatabase();
		await migrateToLatest(db);
		expect(await listLanguages(db)).toHaveLength(4);
	});
});
