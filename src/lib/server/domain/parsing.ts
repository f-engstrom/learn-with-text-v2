import type { Language } from './languages';

export { normalise, termKey } from '../../normalise';

/** A piece of text: a Word, or the punctuation and spaces between Words. */
export interface Token {
	text: string;
	isWord: boolean;
}

export interface ParsedSentence {
	tokens: Token[];
}

export interface ParsedParagraph {
	sentences: ParsedSentence[];
}

/** The Parser seam (ADR 0002): one implementation today, room for e.g. jieba later. */
export interface Parser {
	parse(text: string): ParsedParagraph[];
}

const hasLetter = /\p{L}/u;

/** Splits text with ICU's word and sentence segmentation. Numbers are not Words. */
export class SegmenterParser implements Parser {
	private readonly sentences: Intl.Segmenter;
	private readonly words: Intl.Segmenter;

	constructor(code: string) {
		this.sentences = new Intl.Segmenter(code, { granularity: 'sentence' });
		this.words = new Intl.Segmenter(code, { granularity: 'word' });
	}

	parse(text: string): ParsedParagraph[] {
		return text
			.replace(/\r\n?/g, '\n')
			.split('\n')
			.filter((line) => line.trim() !== '')
			.map((line) => ({
				sentences: [...this.sentences.segment(line.trim())].map(({ segment }) => ({
					tokens: [...this.words.segment(segment)].map((s) => ({
						text: s.segment,
						isWord: s.isWordLike === true && hasLetter.test(s.segment)
					}))
				}))
			}));
	}
}

export function parserFor(language: Pick<Language, 'code'>): Parser {
	return new SegmenterParser(language.code);
}

export function countWords(paragraphs: ParsedParagraph[]): number {
	return paragraphs
		.flatMap((p) => p.sentences)
		.flatMap((s) => s.tokens)
		.filter((t) => t.isWord).length;
}
