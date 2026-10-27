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
