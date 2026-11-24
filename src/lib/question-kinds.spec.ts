import { describe, it, expect } from 'vitest';
import { gapsAnswer, matchAnswer, orderAnswer, shuffledIndexes } from './question-kinds';

describe('Question kinds', () => {
	it('shuffle the same way for the same seed, never into the order that is right', () => {
		for (const n of [2, 3, 5, 12]) {
			for (const seed of ['a', 'b', '2026-11-24T10:00:00.000Z 0', '2026-11-24T10:00:00.000Z 1']) {
				const order = shuffledIndexes(n, seed);
				expect([...order].sort((a, b) => a - b)).toEqual([...Array(n).keys()]);
				expect(order).not.toEqual([...Array(n).keys()]);
				expect(shuffledIndexes(n, seed)).toEqual(order);
			}
		}
		expect(shuffledIndexes(1, 'a')).toEqual([0]);
	});

	it('answer with one line of text the Tutor reads', () => {
		expect(orderAnswer(['новое', 'лицо', 'появилось'])).toBe('новое лицо появилось');
		expect(gapsAnswer('на ___ появилось новое ___.', ['набережной', ' лицо '])).toBe('на [набережной] появилось новое [лицо].');
		expect(matchAnswer(['кот', 'мышь'], ['cat', 'mouse'])).toBe('кот = cat\nмышь = mouse');
	});
});
