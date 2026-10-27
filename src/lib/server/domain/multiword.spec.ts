import { describe, it, expect } from 'vitest';
import { candidateSpans, chooseSpans, MAX_TERM_WORDS, type Span } from './multiword';
import { parserFor } from './parsing';

type Rules = { code: string; characterMap: Record<string, string> };
const russian: Rules = { code: 'ru', characterMap: { '́': '', '̀': '' } };
const chinese: Rules = { code: 'zh', characterMap: {} };

const tokensOf = (text: string, language = russian) => parserFor(language).parse(text)[0].sentences[0].tokens;
const keys = (spans: Span[]) => spans.map((s) => s.key);

describe('candidateSpans', () => {
	it('lists every run of two or more Words, with its Normalised form', () => {
		expect(keys(candidateSpans(tokensOf('В тече́ние дня'), russian))).toEqual(['в течение', 'в течение дня', 'течение дня']);
	});

	it('treats any whitespace between Words as one space', () => {
		expect(keys(candidateSpans(tokensOf('в   течение'), russian))).toEqual(['в течение']);
	});

	it('joins Words written together without a space', () => {
		const spans = candidateSpans(tokensOf('我喜欢猫', chinese), chinese);
		expect(keys(spans)).toContain('我喜欢猫');
	});

	it('never crosses punctuation', () => {
		expect(keys(candidateSpans(tokensOf('Кот, мышь и сыр'), russian))).toEqual(['мышь и', 'мышь и сыр', 'и сыр']);
		expect(keys(candidateSpans(tokensOf('кое-что'), russian))).toEqual([]);
	});

	it(`stops at ${MAX_TERM_WORDS} Words`, () => {
		const spans = candidateSpans(tokensOf('а б в г д е ж з'), russian);
		expect(Math.max(...spans.map((s) => s.words))).toBe(MAX_TERM_WORDS);
	});
});

describe('chooseSpans', () => {
	const choose = (text: string, terms: string[]) =>
		keys(chooseSpans(candidateSpans(tokensOf(text), russian), (key) => terms.includes(key)));

	it('keeps only spans with a Term', () => {
		expect(choose('в течение дня', ['в течение'])).toEqual(['в течение']);
		expect(choose('в течение дня', [])).toEqual([]);
	});

	it('lets the longest of overlapping Terms win', () => {
		expect(choose('в течение дня', ['в течение', 'в течение дня'])).toEqual(['в течение дня']);
		expect(choose('в течение дня', ['течение дня', 'в течение дня'])).toEqual(['в течение дня']);
	});

	it('gives a tie to the Term that starts first', () => {
		expect(choose('в течение дня', ['в течение', 'течение дня'])).toEqual(['в течение']);
	});

	it('keeps Terms that do not overlap, in text order', () => {
		expect(choose('тем не менее в течение дня', ['в течение', 'тем не менее'])).toEqual(['тем не менее', 'в течение']);
	});
});
