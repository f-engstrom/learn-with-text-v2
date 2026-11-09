import { describe, it, expect } from 'vitest';
import { highlightOnPage, turnParagraph, passageParts } from './highlight';

describe('passageParts', () => {
	const tokens = ['которые', ' ', 'сами', ' ', 'бы', ' ', 'охотно', ' ', 'грешили', ', ', 'если', ' ', 'б', ' ', 'умели', ', ', 'но'];

	it('gives the parts a passage covers, in any case and spacing', () => {
		expect(passageParts(tokens, 'Сами бы  охотно')).toEqual([2, 3, 4, 5, 6]);
		expect(passageParts(tokens, 'если б умели')).toEqual([10, 11, 12, 13, 14]);
	});

	it('runs across parts that end in spaces, like Sentences', () => {
		expect(passageParts(['Кот спит. ', 'Мышь бежит.'], 'спит. мышь')).toEqual([0, 1]);
	});

	it('is undefined when the passage is not there, or empty', () => {
		expect(passageParts(tokens, 'никогда')).toBeUndefined();
		expect(passageParts(tokens, '  ')).toBeUndefined();
	});
});

describe('highlightOnPage', () => {
	const sentence = (...tokens: string[]) => ({ tokens: tokens.map((text) => ({ text })) });
	const page = [sentence('Кот', ' ', 'спит', '.'), sentence('Мышь', ' ', 'бежит', '.'), sentence('Пёс', ' ', 'лает', '.')];
	const at = '2026-11-08T20:00:00Z';

	it('covers whole Sentences when the Highlight has no passage', () => {
		expect(highlightOnPage(page, { page: 2, first: 2, last: 3, at }, 2)).toEqual({ first: 1, sentences: new Set([1, 2]) });
	});

	it('covers the passage’s tokens, across Sentences', () => {
		const here = highlightOnPage(page, { page: 2, first: 1, last: 2, text: 'спит. Мышь', at }, 2);
		expect(here?.tokens).toEqual(new Set(['0:2', '0:3', '1:0']));
	});

	it('covers no tokens when the passage isn’t in its Sentences', () => {
		expect(highlightOnPage(page, { page: 2, first: 1, last: 1, text: 'лает', at }, 2)?.tokens).toEqual(new Set());
	});

	it('is nothing on another Page, or with no Highlight', () => {
		expect(highlightOnPage(page, { page: 3, first: 1, last: 1, at }, 2)).toBeUndefined();
		expect(highlightOnPage(page, null, 2)).toBeUndefined();
	});
});

describe('turnParagraph', () => {
	const paragraphs = [{ sentences: [1, 2] }, { sentences: [3] }, { sentences: [4, 5] }];
	const on = (...sentences: number[]) => ({ first: sentences[0], sentences: new Set(sentences) });

	it('is the paragraph holding the Highlight’s last Sentence', () => {
		expect(turnParagraph(paragraphs, on(0))).toBe(0);
		expect(turnParagraph(paragraphs, on(1, 2))).toBe(1);
		expect(turnParagraph(paragraphs, on(4))).toBe(2);
	});

	it('is nothing without a Highlight here, or past the Page’s end', () => {
		expect(turnParagraph(paragraphs, undefined)).toBeUndefined();
		expect(turnParagraph(paragraphs, on())).toBeUndefined();
	});
});
