import { describe, it, expect } from 'vitest';
import { moveCursor } from './cursor';

// Three Sentences: Words 0–1, 2–4 and 5.
const words = [0, 0, 1, 1, 1, 2].map((sentence) => ({ sentence }));
const move = (by: 1 | -1) => ({ kind: 'move' as const, by });
const sentence = (by: 1 | -1) => ({ kind: 'sentence' as const, by });

describe('moveCursor', () => {
	it('starts at the first Word going forward and the last going back', () => {
		expect(moveCursor(words, undefined, move(1))).toBe(0);
		expect(moveCursor(words, undefined, move(-1))).toBe(5);
		expect(moveCursor(words, undefined, sentence(1))).toBe(0);
	});

	it('moves one Word and stops at the ends', () => {
		expect(moveCursor(words, 2, move(1))).toBe(3);
		expect(moveCursor(words, 2, move(-1))).toBe(1);
		expect(moveCursor(words, 5, move(1))).toBe(5);
		expect(moveCursor(words, 0, move(-1))).toBe(0);
	});

	it('moves to the start of the next Sentence', () => {
		expect(moveCursor(words, 0, sentence(1))).toBe(2);
		expect(moveCursor(words, 3, sentence(1))).toBe(5);
		expect(moveCursor(words, 5, sentence(1))).toBe(5);
	});

	it('moves back to the start of this Sentence, then the previous one', () => {
		expect(moveCursor(words, 4, sentence(-1))).toBe(2);
		expect(moveCursor(words, 2, sentence(-1))).toBe(0);
		expect(moveCursor(words, 0, sentence(-1))).toBe(0);
	});

	it('has nowhere to go on a Page without Words', () => {
		expect(moveCursor([], undefined, move(1))).toBeUndefined();
	});
});
