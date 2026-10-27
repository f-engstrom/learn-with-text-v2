import type { PracticeView, RecallStrength } from '#lib/server/domain/practice.ts';
import type { Status } from '#lib/server/domain/terms.ts';

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
}

/** How many Words "Top by priority" takes. */
export const TOP = 10;

/** Practice priority between two Due Words; most overdue first until Frequency and Transfer exist. */
export function byPriority(a: DueWord, b: DueWord): number {
	return b.practice.overdue - a.practice.overdue || Date.parse(a.practice.due) - Date.parse(b.practice.due) || a.index - b.index;
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
