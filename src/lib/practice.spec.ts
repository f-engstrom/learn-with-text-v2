import { describe, it, expect } from 'vitest';
import { dueLabel, holdsLabel } from './practice';

const at = (day: number, hour: number) => new Date(2026, 9, day, hour);
const due = (date: Date) => ({ due: date.toISOString(), overdue: 0 as const, reviews: 0 });

describe('dueLabel', () => {
	it('counts calendar days, so later today is today', () => {
		expect(dueLabel(due(at(27, 21)), at(27, 9))).toBe('Due today');
		expect(dueLabel(due(at(28, 1)), at(27, 23))).toBe('Due tomorrow');
		expect(dueLabel(due(at(30, 9)), at(27, 9))).toBe('Due in 3 days');
		expect(dueLabel(due(at(25, 9)), at(27, 9))).toBe('2 days overdue');
		expect(dueLabel(due(at(26, 9)), at(27, 9))).toBe('1 day overdue');
	});
});

describe('holdsLabel', () => {
	it('says how long the memory holds and the chance of recall today', () => {
		expect(holdsLabel({ level: 'learning3', holdsDays: 10.4, today: 0.937 })).toBe('holds ~10 days, 94% today');
		expect(holdsLabel({ level: 'known', holdsDays: 120, today: 0.99 })).toBe('holds ~4 months, 99% today');
	});
});
