import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { listLanguages, type Language } from './languages';
import { practiceViews } from './practice';
import { isLearning } from '../../terms';
import type { Status } from './terms';

/** Words read totals worth marking (see CONTEXT.md). */
export const MILESTONES = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 3_000_000] as const;

/** How far back the Progress page looks. */
export const WEEKS_SHOWN = 12;
export const FORECAST_DAYS = 14;
const KNOWN_DAYS_SHOWN = 90;

/** A local calendar day as YYYY-MM-DD: days follow the clock of the computer the Reader runs on. */
export type Day = string;

export interface ReadingDay {
	day: Day;
	words: number;
	/** You marked a Page Read, made a Review or saved a Term. */
	reading: boolean;
}

export interface LanguageProgress {
	language: Language;
	wordsRead: number;
	/** The last Milestone passed and the next one, if any. */
	milestone: { passed?: number; next?: number };
	/** The last seven days, today last. */
	week: ReadingDay[];
	/** Words read per week (from Monday) for the last WEEKS_SHOWN weeks, this week last. */
	weeks: { start: Day; words: number }[];
	known: number;
	learning: number;
	/** Known Terms at the end of each day from the start of the Status history (at most 90 days back), today last. */
	knownHistory: { day: Day; known: number }[];
	/** Terms coming Due on each of the next FORECAST_DAYS days, today first and holding everything already Due. */
	forecast: { day: Day; due: number }[];
}

export interface DaySoFar {
	wordsRead: number;
	/** Terms saved at Learning 1–4 today. */
	newTerms: number;
	/** Terms that became Known today, including those made Known by Mark as read. */
	nowKnown: number;
	reviews: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayOf(date: Date): Day {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, n: number): Date {
	const moved = new Date(date);
	moved.setDate(moved.getDate() + n);
	return moved;
}

function startOfDay(date: Date): Date {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	return start;
}

/** The Monday that starts the week holding `date`. */
function weekStart(date: Date): Date {
	return addDays(startOfDay(date), -((date.getDay() + 6) % 7));
}

export function milestone(wordsRead: number): { passed?: number; next?: number } {
	const passed = MILESTONES.filter((m) => m <= wordsRead).at(-1);
	const next = MILESTONES.find((m) => m > wordsRead);
	return { ...(passed ? { passed } : {}), ...(next ? { next } : {}) };
}

/** Progress for every Language you have Books or Terms in. */
export async function getProgress(db: Kysely<Database>, now = new Date()): Promise<LanguageProgress[]> {
	const languages = await listLanguages(db);
	const since = addDays(weekStart(now), -7 * (WEEKS_SHOWN - 1));
	const [books, pages, changes, reviews, terms] = await Promise.all([
		db.selectFrom('book').select('language_id').distinct().execute(),
		db
			.selectFrom('page')
			.innerJoin('book', 'book.id', 'page.book_id')
			.select(['book.language_id', 'page.words', 'page.read_at'])
			.where('page.read_at', 'is not', null)
			.execute(),
		db.selectFrom('status_change').select(['language_id', 'from_status', 'to_status', 'changed_at']).orderBy('changed_at').execute(),
		db
			.selectFrom('review')
			.innerJoin('term', 'term.id', 'review.term_id')
			.select(['term.language_id', 'review.reviewed_at'])
			.where('review.reviewed_at', '>=', addDays(startOfDay(now), -6).toISOString())
			.execute(),
		db.selectFrom('term').select(['id', 'language_id', 'status']).execute()
	]);
	const practice = await practiceViews(db, terms, now);

	const progress: LanguageProgress[] = [];
	for (const language of languages) {
		const read = pages.filter((p) => p.language_id === language.id);
		const history = changes.filter((c) => c.language_id === language.id);
		const own = terms.filter((t) => t.language_id === language.id);
		if (!books.some((b) => b.language_id === language.id) && own.length === 0 && history.length === 0) continue;

		const wordsOn = new Map<Day, number>();
		for (const p of read) {
			const day = dayOf(new Date(p.read_at!));
			wordsOn.set(day, (wordsOn.get(day) ?? 0) + p.words);
		}
		const readingDays = new Set([
			...wordsOn.keys(),
			...reviews.filter((r) => r.language_id === language.id).map((r) => dayOf(new Date(r.reviewed_at))),
			...history.filter((c) => c.from_status === null).map((c) => dayOf(new Date(c.changed_at)))
		]);
		const wordsRead = read.reduce((sum, p) => sum + p.words, 0);

		const week = Array.from({ length: 7 }, (_, i) => {
			const day = dayOf(addDays(now, i - 6));
			return { day, words: wordsOn.get(day) ?? 0, reading: readingDays.has(day) };
		});

		const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => ({ start: dayOf(addDays(since, 7 * i)), words: 0 }));
		for (const p of read) {
			const at = new Date(p.read_at!);
			if (at < since) continue;
			const index = Math.floor((weekStart(at).getTime() - since.getTime()) / (7 * 864e5) + 0.5);
			if (weeks[index]) weeks[index].words += p.words;
		}

		const known = own.filter((t) => t.status === 'known').length;
		progress.push({
			language,
			wordsRead,
			milestone: milestone(wordsRead),
			week,
			weeks,
			known,
			learning: own.filter((t) => isLearning(t.status)).length,
			knownHistory: knownHistory(history, known, now),
			forecast: forecast(
				own.flatMap((t) => practice.get(t.id) ?? []).map((p) => p.due),
				now
			)
		});
	}
	return progress;
}

/** Known Terms at the end of each day, worked back from today's count through the Status history. */
function knownHistory(
	history: { from_status: Status | null; to_status: Status | null; changed_at: string }[],
	knownNow: number,
	now: Date
): { day: Day; known: number }[] {
	if (history.length === 0) return [{ day: dayOf(now), known: knownNow }];
	const gained = new Map<Day, number>();
	for (const c of history) {
		const change = Number(c.to_status === 'known') - Number(c.from_status === 'known');
		if (change !== 0) {
			const day = dayOf(new Date(c.changed_at));
			gained.set(day, (gained.get(day) ?? 0) + change);
		}
	}
	const first = startOfDay(new Date(history[0].changed_at));
	const earliest = addDays(startOfDay(now), -(KNOWN_DAYS_SHOWN - 1));
	const series: { day: Day; known: number }[] = [];
	let known = knownNow;
	for (let date = startOfDay(now); date >= first && date >= earliest; date = addDays(date, -1)) {
		const day = dayOf(date);
		series.push({ day, known });
		known -= gained.get(day) ?? 0;
	}
	return series.reverse();
}

function forecast(dues: string[], now: Date): { day: Day; due: number }[] {
	const days = Array.from({ length: FORECAST_DAYS }, (_, i) => ({ day: dayOf(addDays(now, i)), due: 0 }));
	const tomorrow = addDays(startOfDay(now), 1);
	for (const due of dues) {
		const at = new Date(due);
		const index = at < tomorrow ? 0 : Math.round((startOfDay(at).getTime() - startOfDay(now).getTime()) / 864e5);
		if (days[index]) days[index].due++;
	}
	return days;
}

/** What today added in a Language. */
export async function daySoFar(db: Kysely<Database>, languageId: number, now = new Date()): Promise<DaySoFar> {
	const from = startOfDay(now).toISOString();
	const to = addDays(startOfDay(now), 1).toISOString();
	const [read, changes, reviews] = await Promise.all([
		db
			.selectFrom('page')
			.innerJoin('book', 'book.id', 'page.book_id')
			.where('book.language_id', '=', languageId)
			.where('page.read_at', '>=', from)
			.where('page.read_at', '<', to)
			.select((eb) => eb.fn.coalesce(eb.fn.sum<number>('page.words'), eb.lit(0)).as('words'))
			.executeTakeFirstOrThrow(),
		db
			.selectFrom('status_change')
			.select(['term_id', 'from_status', 'to_status'])
			.where('language_id', '=', languageId)
			.where('changed_at', '>=', from)
			.where('changed_at', '<', to)
			.orderBy('changed_at')
			.orderBy('id')
			.execute(),
		db
			.selectFrom('review')
			.innerJoin('term', 'term.id', 'review.term_id')
			.where('term.language_id', '=', languageId)
			.where('review.reviewed_at', '>=', from)
			.where('review.reviewed_at', '<', to)
			.select((eb) => eb.fn.countAll<number>().as('n'))
			.executeTakeFirstOrThrow()
	]);

	// Each Term counts once, by where the day took it: new and still there, or Known by the end of it.
	const first = new Map<number, Status | null>();
	const last = new Map<number, Status | null>();
	for (const c of changes) {
		if (!first.has(c.term_id)) first.set(c.term_id, c.from_status);
		last.set(c.term_id, c.to_status);
	}
	const ids = [...last.keys()];
	return {
		wordsRead: Number(read.words),
		newTerms: ids.filter((id) => first.get(id) === null && isLearningNow(last.get(id))).length,
		nowKnown: ids.filter((id) => first.get(id) !== 'known' && last.get(id) === 'known').length,
		reviews: Number(reviews.n)
	};
}

const isLearningNow = (status: Status | null | undefined) => status != null && isLearning(status);
