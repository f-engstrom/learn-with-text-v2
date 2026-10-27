import type { FrequencyBand } from '#lib/server/domain/frequency.ts';
import type { PracticeView, RecallStrength } from '#lib/server/domain/practice.ts';
import type { Status, Transfer } from '#lib/server/domain/terms.ts';

// Wording for practice, shared by the reading screen and the Term list.

const DAY = 24 * 60 * 60 * 1000;

export const levelLabels: Record<Status, string> = {
	learning1: 'Learning 1',
	learning2: 'Learning 2',
	learning3: 'Learning 3',
	learning4: 'Learning 4',
	known: 'Known',
	ignored: 'Ignored'
};

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Whole calendar days from `now` to `date`, in local time: 0 today, 1 tomorrow, -2 the day before yesterday. */
function calendarDays(date: Date, now: Date): number {
	const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	return Math.round((midnight(date) - midnight(now)) / DAY);
}

/** "Due today", "Due tomorrow", "Due in 3 days", "2 days overdue". */
export function dueLabel(practice: PracticeView, now = new Date()): string {
	const until = calendarDays(new Date(practice.due), now);
	if (until === 0) return 'Due today';
	if (until === 1) return 'Due tomorrow';
	return until > 0 ? `Due in ${days(until)}` : `${days(-until)} overdue`;
}

/** "holds ~10 days, 94% today". */
export function holdsLabel(recall: RecallStrength): string {
	const held = recall.holdsDays < 1 ? 'under a day' : recall.holdsDays < 60 ? `~${days(Math.round(recall.holdsDays))}` : `~${Math.round(recall.holdsDays / 30)} months`;
	return `holds ${held}, ${Math.round(recall.today * 100)}% today`;
}

/** The subsets of a Page's Due Words you can practise. */
export type Subset = 'priority' | 'paragraph' | 'highlight' | 'overdue';

export const subsetLabels: Record<Subset, string> = {
	priority: 'Top by priority',
	paragraph: 'This paragraph',
	highlight: 'The Highlight',
	overdue: 'Most overdue'
};

/** A Due Word on the Page: where it is, and its Term's place in practice. */
export interface DueWord {
	index: number;
	key: string;
	/** 1-based Sentence and paragraph on the Page. */
	sentence: number;
	paragraph: number;
	practice: PracticeView;
	frequency?: FrequencyBand;
	transfer?: Transfer;
}

const transferPoints = { easy: 0, medium: 1, hard: 2 } as const;

/** How hard a Term is to carry over: 0 (form and concept easy) to 4 (both hard); -1 when not judged. */
export function transferScore(transfer: Transfer | undefined): number {
	return transfer ? transferPoints[transfer.form] + transferPoints[transfer.concept] : -1;
}

export const frequencyLabels: Record<FrequencyBand, string> = {
	top1k: 'top 1,000',
	top5k: 'top 5,000',
	top20k: 'top 20,000',
	rare: 'rare'
};

const bandOrder: Record<FrequencyBand, number> = { top1k: 0, top5k: 1, top20k: 2, rare: 3 };

/** How many Words "Top by priority" takes. */
export const TOP = 10;

/** Practice priority between two Due Words: the more frequent first, then the harder to carry over, then the more overdue. */
export function byPriority(a: DueWord, b: DueWord): number {
	const band = (w: DueWord) => (w.frequency ? bandOrder[w.frequency] : 4);
	return (
		band(a) - band(b) ||
		transferScore(b.transfer) - transferScore(a.transfer) ||
		b.practice.overdue - a.practice.overdue ||
		Date.parse(a.practice.due) - Date.parse(b.practice.due) ||
		a.index - b.index
	);
}

/**
 * The Words to practise, in order: each Due Term once, at its first place in the subset.
 * Paragraph and Highlight keep the text's order; the others go by priority or overdueness.
 */
export function practiceQueue(
	words: DueWord[],
	subset: Subset,
	{ paragraph, highlight }: { paragraph?: number; highlight?: { first: number; last: number } } = {}
): number[] {
	const due = words.filter((w) => w.practice.overdue > 0);
	const seen = new Set<string>();
	const once = (list: DueWord[]) => list.filter((w) => !seen.has(w.key) && seen.add(w.key));
	switch (subset) {
		case 'paragraph':
			return once(due.filter((w) => w.paragraph === paragraph)).map((w) => w.index);
		case 'highlight':
			return highlight ? once(due.filter((w) => w.sentence >= highlight.first && w.sentence <= highlight.last)).map((w) => w.index) : [];
		case 'priority':
			return once([...due].sort(byPriority)).slice(0, TOP).map((w) => w.index);
		case 'overdue':
			return once([...due].sort((a, b) => Date.parse(a.practice.due) - Date.parse(b.practice.due) || a.index - b.index)).map((w) => w.index);
	}
}

/** "form easy, concept hard". */
export function transferLabel(transfer: Transfer): string {
	return `form ${transfer.form}, concept ${transfer.concept}`;
}

/** How many Reviews Recall strength needs before it suggests a Status. */
const SETTLED = 3;

/**
 * A Status to suggest when the other views of a Term agree with each other and not with yours: the
 * Tutor's assessment, and Recall strength once it rests on a few Reviews (ADR 0004). Never Ignored.
 */
export function suggestedStatus(
	status: Status,
	tutor: Status | undefined,
	practice: PracticeView | undefined
): { level: Status; from: string } | undefined {
	if (status === 'ignored') return undefined;
	const recall = practice?.recall && practice.reviews >= SETTLED ? practice.recall.level : undefined;
	const views = [tutor, recall].filter((v): v is Status => v !== undefined);
	if (views.length === 0 || views.some((v) => v !== views[0]) || views[0] === status) return undefined;
	const from = tutor && recall ? 'The Tutor and your Reviews point' : tutor ? 'The Tutor points' : 'Your Reviews point';
	return { level: views[0], from };
}
