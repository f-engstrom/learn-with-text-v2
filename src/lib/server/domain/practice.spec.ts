import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { findTerms, saveTerm } from './terms';
import { InvalidReview, practiceView, recallLevel, recordReview } from './practice';

const DAY = 24 * 60 * 60 * 1000;
const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY);

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const russian = (await listLanguages(db)).find((l) => l.code === 'ru')!;
	const save = (text: string, status = 'learning1', more = {}) => saveTerm(db, { languageId: russian.id, text, status, ...more });
	const view = async (text: string) => (await findTerms(db, russian.id, [text]))[text];
	return { db, save, view };
}

describe('practiceView', () => {
	it('makes a Term with no Reviews Due a day after it was saved', () => {
		expect(practiceView(undefined, day(0).toISOString(), day(0.5))).toMatchObject({ due: day(1).toISOString(), overdue: 0, reviews: 0 });
		expect(practiceView(undefined, day(0).toISOString(), day(1.2)).overdue).toBe(1);
		expect(practiceView(undefined, day(0).toISOString(), day(2)).overdue).toBe(2);
		expect(practiceView(undefined, day(0).toISOString(), day(4)).overdue).toBe(3);
		expect(practiceView(undefined, day(0).toISOString(), day(4)).recall).toBeUndefined();
	});

	it('reads overdue next to the interval: two days late is little on a month, a lot on a day', () => {
		const card = (scheduled_days: number) => ({
			term_id: 1, due: day(10).toISOString(), stability: scheduled_days, difficulty: 5, state: 2, reps: 3, lapses: 0,
			scheduled_days, learning_steps: 0, last_review: day(10 - scheduled_days).toISOString()
		});
		expect(practiceView(card(30), day(0).toISOString(), day(12)).overdue).toBe(1);
		expect(practiceView(card(1), day(0).toISOString(), day(12)).overdue).toBe(3);
	});
});

describe('recallLevel', () => {
	it('puts stability on the Status scale', () => {
		expect([1, 5, 20, 60, 120].map(recallLevel)).toEqual(['learning1', 'learning2', 'learning3', 'learning4', 'known']);
	});
});

describe('recordReview', () => {
	it('schedules further out after Got it than after Missed, and gives Recall strength', async () => {
		const { db, save, view } = await setup();
		const got = await save('кот');
		const missed = await save('мышь');
		const afterGot = await recordReview(db, got, 'got', 'page', day(0));
		const afterMissed = await recordReview(db, missed, 'missed', 'page', day(0));
		expect(new Date(afterGot.due).getTime()).toBeGreaterThan(new Date(afterMissed.due).getTime());
		expect(afterGot).toMatchObject({ overdue: 0, reviews: 1, recall: { level: 'learning2' } });
		expect(afterMissed.recall!.level).toBe('learning1');
		expect(afterGot.recall!.today).toBeCloseTo(1, 2);

		// A run of Got it stretches the interval and raises Recall strength.
		let now = day(0);
		let last = afterGot;
		for (let i = 0; i < 6; i++) {
			now = new Date(last.due);
			last = await recordReview(db, got, 'got', 'list', now);
		}
		expect(last.recall!.holdsDays).toBeGreaterThan(30);
		expect((await view('кот')).practice).toMatchObject({ reviews: 7 });
	});

	it('only practises Learning 1–4 Terms, and Known and Ignored have no practice', async () => {
		const { db, save, view } = await setup();
		const known = await save('дом', 'known');
		await expect(recordReview(db, known, 'got', 'page')).rejects.toThrow(InvalidReview);
		expect((await view('дом')).practice).toBeUndefined();
		const learning = await save('лес');
		await expect(recordReview(db, learning, 'great', 'page')).rejects.toThrow(InvalidReview);
		expect((await view('лес')).practice).toMatchObject({ reviews: 0 });
	});

	it('shares the schedule of a Parent the Term follows', async () => {
		const { db, save, view } = await setup();
		const form = await save('читала', 'learning2', { parent: 'читать', followsParent: true });
		await save('видела', 'learning2', { parent: 'видеть' });
		await recordReview(db, form, 'got', 'page', day(0));
		expect((await view('читать')).practice).toMatchObject({ reviews: 1 });
		expect((await view('читала')).practice).toEqual((await view('читать')).practice);
		expect((await view('видела')).practice).toMatchObject({ reviews: 0 });
		expect((await view('видеть')).practice).toMatchObject({ reviews: 0 });
	});
});
