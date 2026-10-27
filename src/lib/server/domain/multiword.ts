import type { Language } from './languages';
import type { Token } from './parsing';
import { termKey } from './parsing';

/** The most Words a Term can have. */
export const MAX_TERM_WORDS = 7;

/** A run of Words in a Sentence, by token index (both ends are Words), with its Normalised form. */
export interface Span {
	start: number;
	end: number;
	words: number;
	key: string;
}

const isSpace = (token: Token) => token.text.trim() === '';

/**
 * Every run of two to MAX_TERM_WORDS Words in a Sentence with only whitespace (or nothing) between
 * them: the places a Multi-word Term could match. Punctuation between Words breaks a run.
 */
export function candidateSpans(tokens: Token[], language: Pick<Language, 'code' | 'characterMap'>): Span[] {
	const spans: Span[] = [];
	tokens.forEach((first, start) => {
		if (!first.isWord) return;
		let words = 1;
		let text = first.text;
		for (let end = start + 1; end < tokens.length && words < MAX_TERM_WORDS; end++) {
			const token = tokens[end];
			text += token.text;
			if (!token.isWord) {
				if (isSpace(token)) continue;
				break;
			}
			words++;
			spans.push({ start, end, words, key: termKey(text, language) });
		}
	});
	return spans;
}

/**
 * The spans that show as Multi-word Terms: those with a Term, where overlapping ones go to the
 * longest, and ties to the one that starts first. Returned in text order.
 */
export function chooseSpans(spans: Span[], hasTerm: (key: string) => boolean): Span[] {
	const chosen: Span[] = [];
	const byPreference = spans
		.filter((s) => hasTerm(s.key))
		.toSorted((a, b) => b.words - a.words || a.start - b.start);
	for (const span of byPreference) {
		if (chosen.every((c) => span.end < c.start || span.start > c.end)) chosen.push(span);
	}
	return chosen.toSorted((a, b) => a.start - b.start);
}
