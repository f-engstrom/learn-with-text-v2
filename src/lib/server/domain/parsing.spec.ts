import { describe, it, expect } from 'vitest';
import { normalise, parserFor } from './parsing';

const russian = { code: 'ru', characterMap: { '́': '', '̀': '' } };
const farsi = { code: 'fa', characterMap: { 'ي': 'ی', 'ك': 'ک' } };
const bosnian = { code: 'bs', characterMap: {} };
const chinese = { code: 'zh', characterMap: {} };

function words(language: { code: string }, text: string) {
	return parserFor(language)
		.parse(text)
		.flatMap((p) => p.sentences)
		.flatMap((s) => s.tokens)
		.filter((t) => t.isWord)
		.map((t) => t.text);
}

function sentences(language: { code: string }, text: string) {
	return parserFor(language)
		.parse(text)
		.flatMap((p) => p.sentences)
		.map((s) => s.tokens.map((t) => t.text).join(''));
}

describe('parsing', () => {
	it('splits Russian into Words, keeping stressed Words whole', () => {
		expect(words(russian, 'Я чита́ю книгу, да!')).toEqual(['Я', 'чита́ю', 'книгу', 'да']);
	});

	it('keeps punctuation and spaces as non-Words without losing text', () => {
		const text = 'Ещё раз, пожалуйста! Т. е. всё хорошо.';
		expect(sentences(russian, text).join('')).toBe(text);
	});

	it('splits Russian Sentences, not at abbreviations', () => {
		expect(sentences(russian, 'Я читаю. Т. е. всё хорошо.')).toEqual(['Я читаю. ', 'Т. е. всё хорошо.']);
	});

	it('segments Chinese into Words and Sentences', () => {
		expect(words(chinese, '我喜欢学习中文。')).toEqual(['我', '喜欢', '学习', '中文']);
		expect(sentences(chinese, '今天天气很好！你呢？')).toEqual(['今天天气很好！', '你呢？']);
	});

	it('keeps the zero-width non-joiner inside a Farsi Word', () => {
		expect(words(farsi, 'من می‌خواهم کتاب بخوانم.')).toEqual(['من', 'می‌خواهم', 'کتاب', 'بخوانم']);
	});

	it('does not count numbers as Words', () => {
		expect(words(bosnian, 'Imam 12 knjiga.')).toEqual(['Imam', 'knjiga']);
	});

	it('makes each non-blank line a paragraph', () => {
		const paragraphs = parserFor(bosnian).parse('Prvi red.\r\n\r\nDrugi red.\n');
		expect(paragraphs).toHaveLength(2);
	});
});

describe('normalise', () => {
	it('removes Russian stress marks and lowercases', () => {
		expect(normalise('Чита́ть', russian)).toBe('читать');
		expect(normalise('за̀мок', russian)).toBe('замок');
	});

	it('keeps ё distinct from е', () => {
		expect(normalise('Всё', russian)).toBe('всё');
		expect(normalise('всё', russian)).not.toBe(normalise('все', russian));
	});

	it('maps Arabic yeh and kaf to their Persian forms', () => {
		expect(normalise('كتاب', farsi)).toBe(normalise('کتاب', farsi));
		expect(normalise('علي', farsi)).toBe('علی');
	});

	it('treats decomposed and composed text the same', () => {
		expect(normalise('Č'.normalize('NFD'), bosnian)).toBe('č');
	});
});
