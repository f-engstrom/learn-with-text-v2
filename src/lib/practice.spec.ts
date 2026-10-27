import { describe, it, expect } from 'vitest';
import { dueLabel, holdsLabel, practiceQueue } from './practice';

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

describe('practiceQueue', () => {
	const word = (index: number, key: string, paragraph: number, sentence: number, overdue: 0 | 1 | 2 | 3, dueDay: number) => ({
		index, key, paragraph, sentence, practice: { due: new Date(2026, 9, dueDay).toISOString(), overdue, reviews: 1 }
	});
	const words = [
		word(0, 'кот', 1, 1, 1, 26),
		word(1, 'мышь', 1, 1, 0, 30),
		word(2, 'дом', 1, 2, 3, 20),
		word(3, 'кот', 2, 3, 1, 26),
		word(4, 'лес', 2, 3, 2, 24)
	];

	it('takes each Due Term once, leaving out Words not yet Due', () => {
		expect(practiceQueue(words, 'paragraph', { paragraph: 1 })).toEqual([0, 2]);
		expect(practiceQueue(words, 'paragraph', { paragraph: 2 })).toEqual([3, 4]);
	});

	it('takes the Highlight in text order', () => {
		expect(practiceQueue(words, 'highlight', { highlight: { first: 2, last: 3 } })).toEqual([2, 3, 4]);
		expect(practiceQueue(words, 'highlight')).toEqual([]);
	});

	it('orders by priority (most overdue first, for now) and by Due date', () => {
		expect(practiceQueue(words, 'priority')).toEqual([2, 4, 0]);
		expect(practiceQueue(words, 'overdue')).toEqual([2, 4, 0]);
	});
});
