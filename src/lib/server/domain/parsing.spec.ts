import { describe, it, expect } from 'vitest';
import { characterParts, normalise, parserFor, partKeys } from './parsing';

const russian = { code: 'ru', characterMap: { '́': '', '̀': '' } };
const farsi = { code: 'fa', characterMap: { 'ي': 'ی', 'ك': 'ک' } };
const bosnian = { code: 'bs', characterMap: {} };
const chinese = { code: 'zh', characterMap: {} };
const albanian = { code: 'sq', characterMap: {} };
const indonesian = { code: 'id', characterMap: {} };

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

	it('splits Albanian into Words and Sentences, keeping ë and ç inside Words', () => {
		const text = 'Unë lexoj një libër çdo ditë. Ajo është e mirë!';
		expect(words(albanian, text)).toEqual(['Unë', 'lexoj', 'një', 'libër', 'çdo', 'ditë', 'Ajo', 'është', 'e', 'mirë']);
		expect(sentences(albanian, text)).toEqual(['Unë lexoj një libër çdo ditë. ', 'Ajo është e mirë!']);
	});

	it('keeps a hyphenated Russian Word whole', () => {
		expect(words(russian, 'Назвали почему-то моим именем, кое-что по-русски.')).toEqual([
			'Назвали',
			'почему-то',
			'моим',
			'именем',
			'кое-что',
			'по-русски'
		]);
	});

	it('keeps a doubled Indonesian Word whole', () => {
		expect(words(indonesian, 'Anak-anak membaca buku-buku.')).toEqual(['Anak-anak', 'membaca', 'buku-buku']);
	});

	it('keeps a Word of three hyphenated parts whole', () => {
		expect(words(russian, 'Он сказал крест-накрест-то.')).toEqual(['Он', 'сказал', 'крест-накрест-то']);
	});

	it('splits at a dash, a spaced hyphen or a hyphen beside a number', () => {
		expect(words(russian, 'Он — студент - школьник, 5-й класс, раз-')).toEqual(['Он', 'студент', 'школьник', 'й', 'класс', 'раз']);
	});

	it('keeps the text of a hyphenated Word unchanged', () => {
		const text = 'Почему-то он пришёл. Кое-кто нет.';
		expect(sentences(russian, text)).toEqual(['Почему-то он пришёл. ', 'Кое-кто нет.']);
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

describe('characterParts', () => {
	it('splits a Word of two or more Chinese characters into its characters', () => {
		expect(characterParts('我的')).toEqual(['我', '的']);
		expect(partKeys('图书馆')).toEqual(['图', '图书', '书', '书馆', '馆']);
	});

	it('leaves other Words whole', () => {
		expect(characterParts('我')).toBeUndefined();
		expect(characterParts('кот')).toBeUndefined();
		expect(partKeys('кот')).toEqual([]);
	});
});
