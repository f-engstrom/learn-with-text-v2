import { describe, it, expect } from 'vitest';
import { bookmarkedWord } from './bookmark';

describe('bookmarkedWord', () => {
	const tokens = [{ text: 'Кот', key: 'кот' }, { text: ' ' }, { text: 'в течение', key: 'в течение' }, { text: '.' }];

	it('finds the Word in any case, a Multi-word Term too', () => {
		expect(bookmarkedWord(tokens, 'кот', 'ru')).toBe(tokens[0]);
		expect(bookmarkedWord(tokens, 'В течение', 'ru')).toBe(tokens[2]);
	});

	it('is nothing without a Word, or for text that isn’t a Word', () => {
		expect(bookmarkedWord(tokens, undefined, 'ru')).toBeUndefined();
		expect(bookmarkedWord(tokens, '.', 'ru')).toBeUndefined();
	});
});
