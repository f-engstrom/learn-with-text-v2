import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateTo, migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { createBook } from './books';
import { deleteTerm, saveTerm } from './terms';
import { markPageRead } from './reading';
import { recordReview } from './practice';
import { daySoFar, dayOf, getProgress, milestone } from './progress';

/** Noon, local time, `n` days from today: clear of midnight whatever the time zone. */
const day = (n: number) => {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() + n);
	return d;
};

async function setup(text = 'Кот спит. Мышь бежит.\n---\nКот и мышь. Мышь спит.') {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const russian = (await listLanguages(db)).find((l) => l.code === 'ru')!;
	const bookId = await createBook(db, { languageId: russian.id, title: 'Кот', text });
	const save = (text: string, status = 'learning1', more = {}) => saveTerm(db, { languageId: russian.id, text, status, ...more });
	const history = async (termId: number) =>
		(await db.selectFrom('status_change').select(['from_status', 'to_status']).where('term_id', '=', termId).orderBy('id').execute()).map(
			(c) => [c.from_status, c.to_status]
		);
	const progress = async (now: Date) => (await getProgress(db, now)).find((p) => p.language.id === russian.id)!;
	return { db, russian, bookId, save, history, progress };
}

describe('Status history', () => {
	it('records a Term being saved, changing Status and being deleted', async () => {
		const { save, history } = await setup();
		const id = await save('кот');
		await save('кот', 'learning1');
		await save('кот', 'known');
		expect(await history(id)).toEqual([
			[null, 'learning1'],
			['learning1', 'known']
		]);
	});

	it('records deletions, Follows Parent and Mark as read', async () => {
		const { db, bookId, save, history } = await setup();
		const child = await save('спит', 'learning2', { parent: 'спать', followsParent: true });
		const parent = (await db.selectFrom('term').select('id').where('normalised', '=', 'спать').executeTakeFirstOrThrow()).id;
		await save('спит', 'known');
		expect(await history(parent)).toEqual([
			[null, 'learning2'],
			['learning2', 'known']
		]);
		await deleteTerm(db, child);
		expect((await history(child)).at(-1)).toEqual(['known', null]);

		await markPageRead(db, bookId, 1, { restKnown: true });
		const kot = (await db.selectFrom('term').select('id').where('normalised', '=', 'кот').executeTakeFirstOrThrow()).id;
		expect(await history(kot)).toEqual([[null, 'known']]);
	});

	it('gives Terms saved before it began one entry each, from when they were saved', async () => {
		const db = openDatabase(':memory:');
		await migrateTo(db, '0016-highlight-passage');
		await db
			.insertInto('term')
			.values({ language_id: 1, text: 'кот', normalised: 'кот', status: 'learning3', created_at: '2026-01-05T10:00:00.000Z' })
			.execute();
		await migrateToLatest(db);
		expect(await db.selectFrom('status_change').select(['from_status', 'to_status', 'changed_at']).execute()).toEqual([
			{ from_status: null, to_status: 'learning3', changed_at: '2026-01-05T10:00:00.000Z' }
		]);
	});
});

describe('Words read', () => {
	it('counts each Page once, on the day it was marked Read', async () => {
		const { db, bookId, progress } = await setup();
		await markPageRead(db, bookId, 1, { now: day(-1) });
		await markPageRead(db, bookId, 2, { now: day(0) });
		await markPageRead(db, bookId, 2, { now: day(0) });
		const p = await progress(day(0));
		expect(p.wordsRead).toBe(9);
		expect(p.week.map((d) => d.words)).toEqual([0, 0, 0, 0, 0, 4, 5]);
		expect(p.week.at(-1)).toMatchObject({ day: dayOf(day(0)), reading: true });
		expect(p.weeks.reduce((sum, w) => sum + w.words, 0)).toBe(9);
		expect(p.weeks).toHaveLength(12);
	});

	it('marks the last Milestone passed and the next', () => {
		expect(milestone(0)).toEqual({ next: 10_000 });
		expect(milestone(25_000)).toEqual({ passed: 25_000, next: 50_000 });
		expect(milestone(3_500_000)).toEqual({ passed: 3_000_000 });
	});
});

describe('getProgress', () => {
	it('works Known Terms back through the Status history', async () => {
		const { db, save, progress } = await setup();
		const ids = [await save('кот', 'known'), await save('мышь', 'known'), await save('спит', 'learning1')];
		const when = [day(-3), day(-1), day(-2)];
		for (const [i, id] of ids.entries()) {
			await db.updateTable('status_change').set({ changed_at: when[i].toISOString() }).where('term_id', '=', id).execute();
		}
		// Today мышь slips back to Learning.
		await save('мышь', 'learning4');
		expect((await progress(day(0))).knownHistory.map((d) => d.known)).toEqual([1, 1, 2, 1]);
		expect((await progress(day(0))).knownHistory[0].day).toBe(dayOf(day(-3)));
		expect(await progress(day(0))).toMatchObject({ known: 1, learning: 2 });
	});

	it('forecasts Due Terms, with everything already Due today', async () => {
		const { db, save, progress } = await setup();
		const kot = await save('кот');
		await save('мышь');
		await recordReview(db, kot, 'got', 'page', new Date());
		const forecast = (await progress(day(30))).forecast;
		expect(forecast).toHaveLength(14);
		expect(forecast[0].due).toBe(2);
		expect(forecast.slice(1).every((d) => d.due === 0)).toBe(true);
		const soon = (await progress(new Date())).forecast;
		expect(soon.reduce((sum, d) => sum + d.due, 0)).toBe(2);
		expect(soon[0].due).toBe(0);
	});

	it('leaves out Languages with nothing in them', async () => {
		const { db } = await setup();
		expect((await getProgress(db)).map((p) => p.language.code)).toEqual(['ru']);
	});
});

describe('daySoFar', () => {
	it('adds up what today added in a Language', async () => {
		const { db, bookId, russian, save } = await setup();
		const kot = await save('кот');
		await recordReview(db, kot, 'missed', 'page');
		await save('мышь');
		await save('мышь', 'known');
		await markPageRead(db, bookId, 1, { restKnown: true });
		// кот: new; мышь: saved and made Known; спит, бежит: Known by Mark as read.
		expect(await daySoFar(db, russian.id)).toEqual({ wordsRead: 4, newTerms: 1, nowKnown: 3, reviews: 1 });
		expect(await daySoFar(db, russian.id, day(1))).toEqual({ wordsRead: 0, newTerms: 0, nowKnown: 0, reviews: 0 });
	});
});
