import type { Kysely, Transaction } from 'kysely';
import { createEmptyCard, fsrs, Rating, type Card, type Grade as FsrsGrade } from 'ts-fsrs';
import type { Database, GradeValue, ReviewSourceValue, ScheduleTable } from '../db/schema';
import type { Status } from './terms';

export type Grade = GradeValue;
export type ReviewSource = ReviewSourceValue;

export const GRADES: readonly Grade[] = ['missed', 'hard', 'got'];
export const REVIEW_SOURCES: readonly ReviewSource[] = ['page', 'list', 'tutor'];

export class InvalidReview extends Error {}

const DAY = 24 * 60 * 60 * 1000;

/** Days-scale scheduling: reading practice has no use for ten-minute relearning steps. */
const scheduler = fsrs({ enable_short_term: false, enable_fuzz: false });
const ratings: Record<Grade, FsrsGrade> = { missed: Rating.Again, hard: Rating.Hard, got: Rating.Good };

/** Statuses that take part in practice (ADR 0004). */
export const isPractised = (status: Status) => status.startsWith('learning');

/** How well the Reviews show you know a Term, on the Status scale. */
export interface RecallStrength {
	level: Status;
	/** Days the memory holds before your chance of recall drops to about 90%. */
	holdsDays: number;
	/** Your chance of recalling it now, 0–1. */
	today: number;
}

/** A practised Term's place in its schedule. */
export interface PracticeView {
	/** When it is (or was) Due. */
	due: string;
	/** 0 not yet Due, 1 Due, 2 overdue, 3 long overdue: how overdue it is next to its interval. */
	overdue: 0 | 1 | 2 | 3;
	/** Reviews on its schedule (its Parent's, if it Follows Parent). */
	reviews: number;
	/** Once there has been a Review. */
	recall?: RecallStrength;
}

/** Stability cut-offs, in days, for Recall strength's level. */
const recallLevels: [number, Status][] = [
	[2, 'learning1'],
	[7, 'learning2'],
	[30, 'learning3'],
	[90, 'learning4']
];

export function recallLevel(stability: number): Status {
	return recallLevels.find(([days]) => stability < days)?.[1] ?? 'known';
}

function toCard(row: ScheduleTable): Card {
	return {
		due: new Date(row.due),
		stability: row.stability,
		difficulty: row.difficulty,
		elapsed_days: 0,
		scheduled_days: row.scheduled_days,
		learning_steps: row.learning_steps,
		reps: row.reps,
		lapses: row.lapses,
		state: row.state,
		last_review: row.last_review ? new Date(row.last_review) : undefined
	};
}

/**
 * Where a Term stands in practice. `schedule` is its own card (or its Parent's); without one, a
 * Term is first Due a day after it was saved.
 */
export function practiceView(schedule: ScheduleTable | undefined, savedAt: string, now = new Date()): PracticeView {
	const due = schedule ? new Date(schedule.due) : new Date(new Date(savedAt).getTime() + DAY);
	const interval = Math.max(schedule?.scheduled_days ?? 1, 1);
	const late = (now.getTime() - due.getTime()) / DAY / interval;
	const overdue = late < 0 ? 0 : late < 0.5 ? 1 : late < 1.5 ? 2 : 3;
	const reviews = schedule?.reps ?? 0;
	if (!schedule || reviews === 0) return { due: due.toISOString(), overdue, reviews };
	return {
		due: due.toISOString(),
		overdue,
		reviews,
		recall: {
			level: recallLevel(schedule.stability),
			holdsDays: schedule.stability,
			today: scheduler.get_retrievability(toCard(schedule), now, false)
		}
	};
}

/** The Term whose schedule this one uses: up the Follows Parent chain to the first that doesn't follow. */
export async function scheduleOwner(db: Kysely<Database> | Transaction<Database>, termId: number): Promise<number> {
	const seen = new Set<number>();
	let current = termId;
	while (!seen.has(current)) {
		seen.add(current);
		const row = await db.selectFrom('term').select(['parent_id', 'follows_parent']).where('id', '=', current).executeTakeFirst();
		if (!row?.follows_parent || row.parent_id === null) break;
		current = row.parent_id;
	}
	return current;
}

/** Practice views for Terms by id, each read from its schedule owner's card. */
export async function practiceViews(
	db: Kysely<Database>,
	terms: { id: number; status: Status }[],
	now = new Date()
): Promise<Map<number, PracticeView>> {
	const practised = terms.filter((t) => isPractised(t.status));
	if (practised.length === 0) return new Map();
	const owners = new Map<number, number>();
	for (const t of practised) owners.set(t.id, await scheduleOwner(db, t.id));
	const ownerIds = [...new Set(owners.values())];
	const [schedules, saved] = await Promise.all([
		db.selectFrom('schedule').selectAll().where('term_id', 'in', ownerIds).execute(),
		db.selectFrom('term').select(['id', 'created_at']).where('id', 'in', ownerIds).execute()
	]);
	const scheduleOf = new Map(schedules.map((s) => [s.term_id, s]));
	const savedAt = new Map(saved.map((s) => [s.id, s.created_at]));
	return new Map(
		practised.map((t) => {
			const owner = owners.get(t.id)!;
			return [t.id, practiceView(scheduleOf.get(owner), savedAt.get(owner) ?? now.toISOString(), now)];
		})
	);
}

/** Records a Review of a Learning Term and moves its schedule (its Parent's, if it Follows Parent). */
export async function recordReview(
	db: Kysely<Database>,
	termId: number,
	grade: string,
	source: string,
	now = new Date()
): Promise<PracticeView> {
	if (!(GRADES as readonly string[]).includes(grade)) throw new InvalidReview(`A Review is graded ${GRADES.join(', ')}.`);
	if (!(REVIEW_SOURCES as readonly string[]).includes(source)) throw new InvalidReview(`Unknown Review source “${source}”.`);
	return db.transaction().execute(async (trx) => {
		const term = await trx.selectFrom('term').select(['text', 'status']).where('id', '=', termId).executeTakeFirst();
		if (!term) throw new InvalidReview('No such Term.');
		if (!isPractised(term.status)) throw new InvalidReview(`Only Learning 1–4 Terms are practised; “${term.text}” is ${term.status}.`);
		const owner = await scheduleOwner(trx, termId);
		const row = await trx.selectFrom('schedule').selectAll().where('term_id', '=', owner).executeTakeFirst();
		const { card } = scheduler.next(row ? toCard(row) : createEmptyCard(now), now, ratings[grade as Grade]);
		const next: ScheduleTable = {
			term_id: owner,
			due: card.due.toISOString(),
			stability: card.stability,
			difficulty: card.difficulty,
			state: card.state,
			reps: card.reps,
			lapses: card.lapses,
			scheduled_days: card.scheduled_days,
			learning_steps: card.learning_steps,
			last_review: card.last_review?.toISOString() ?? now.toISOString()
		};
		await trx
			.insertInto('schedule')
			.values(next)
			.onConflict((oc) => oc.column('term_id').doUpdateSet(next))
			.execute();
		await trx
			.insertInto('review')
			.values({ term_id: termId, grade: grade as Grade, source: source as ReviewSource, reviewed_at: now.toISOString() })
			.execute();
		const saved = await trx.selectFrom('term').select('created_at').where('id', '=', owner).executeTakeFirstOrThrow();
		return practiceView(next, saved.created_at, now);
	});
}
