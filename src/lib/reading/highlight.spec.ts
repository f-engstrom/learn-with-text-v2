import { describe, it, expect } from 'vitest';
import { highlightOnPage, turnPlace, passageParts } from './highlight';

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

describe('turnPlace', () => {
	const sentence = (...texts: string[]) => ({ tokens: texts.map((text) => ({ text })) });
	const paragraphs = [
		{ sentences: [sentence('One', '.'), sentence(' ', 'Two', '.')] },
		{ sentences: [sentence('Three', ', ', 'four', ' ', 'five', '.')] },
		{ sentences: [sentence('Six', '.'), sentence(' ', 'Seven', '.')] }
	];
	const on = (...sentences: number[]) => ({ first: sentences[0], sentences: new Set(sentences) });
	const passage = (sentence: number, ...tokens: number[]) => ({
		...on(sentence),
		tokens: new Set(tokens.map((t) => `${sentence}:${t}`))
	});

	it('is after the Highlight’s last whole Sentence, within its paragraph', () => {
		expect(turnPlace(paragraphs, on(0))).toEqual({ paragraph: 0, sentence: 0, token: 1 });
		expect(turnPlace(paragraphs, on(1, 2))).toEqual({ paragraph: 1, sentence: 0, token: 5 });
		expect(turnPlace(paragraphs, on(3, 4))).toEqual({ paragraph: 2, sentence: 1, token: 2 });
	});

	it('is right after a passage, taking the punctuation stuck to it but not the space', () => {
		expect(turnPlace(paragraphs, passage(2, 0))).toEqual({ paragraph: 1, sentence: 0, token: 1 });
		expect(turnPlace(paragraphs, passage(2, 2))).toEqual({ paragraph: 1, sentence: 0, token: 2 });
		expect(turnPlace(paragraphs, passage(2, 4))).toEqual({ paragraph: 1, sentence: 0, token: 5 });
	});

	it('is after the whole Sentence when the passage isn’t there', () => {
		expect(turnPlace(paragraphs, passage(2))).toEqual({ paragraph: 1, sentence: 0, token: 5 });
	});

	it('is nothing without a Highlight here, or past the Page’s end', () => {
		expect(turnPlace(paragraphs, undefined)).toBeUndefined();
		expect(turnPlace(paragraphs, on())).toBeUndefined();
		expect(turnPlace(paragraphs, on(5))).toBeUndefined();
	});
});
