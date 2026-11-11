// A Highlight in the text: finding its passage (shared by the Reader's check and the reading screen),
// and what it covers on the Page in the reading screen.

import type { Highlight } from '#lib/server/domain/reading.ts';

/** A passage as it is matched: NFC, lowercased, whitespace runs as one space, trimmed. */
export function foldPassage(text: string): string {
	return text.normalize('NFC').toLocaleLowerCase().trim().replace(/\s+/gu, ' ');
}

/**
 * Which of `parts` (consecutive pieces of text, e.g. a Sentence's tokens) the passage covers, in
 * order; undefined if it isn't there. Case and runs of whitespace don't matter.
 */
export function passageParts(parts: string[], passage: string): number[] | undefined {
	const wanted = foldPassage(passage);
	if (wanted === '') return undefined;
	let flat = '';
	const owner: number[] = [];
	let space = true;
	parts.forEach((part, i) => {
		for (const ch of part.normalize('NFC')) {
			const isSpace = /\s/u.test(ch);
			if (isSpace && space) continue;
			const folded = isSpace ? ' ' : ch.toLocaleLowerCase();
			flat += folded;
			for (let k = 0; k < folded.length; k++) owner.push(i);
			space = isSpace;
		}
	});
	const at = flat.indexOf(wanted);
	if (at < 0) return undefined;
	return [...new Set(owner.slice(at, at + wanted.length))];
}

/** Where a Highlight falls on the Page shown. Sentences are 0-based here; a Highlight counts them from 1. */
export interface HighlightOnPage {
	/** The Highlight's first Sentence, where the screen scrolls to. */
	first: number;
	/** Its run of Sentences, underlined whole when it has no passage. */
	sentences: Set<number>;
	/** With a passage, the tokens it covers, as "sentence:token"; empty if the passage isn't there. */
	tokens?: Set<string>;
}

/** Where `highlight` falls among the Page's `sentences`, if it is on Page `position`. */
export function highlightOnPage(
	sentences: { tokens: { text: string }[] }[],
	highlight: Highlight | null | undefined,
	position: number
): HighlightOnPage | undefined {
	if (!highlight || highlight.page !== position) return undefined;
	const run = new Set<number>();
	for (let s = highlight.first - 1; s < Math.min(highlight.last, sentences.length); s++) run.add(s);
	const here = { first: highlight.first - 1, sentences: run };
	if (!highlight.text) return here;
	const keys: string[] = [];
	const parts: string[] = [];
	for (const s of run) {
		sentences[s].tokens.forEach((token, t) => {
			keys.push(`${s}:${t}`);
			parts.push(token.text);
		});
		// Sentences may not end in a space; keep their last and first Words apart.
		keys.push('');
		parts.push(' ');
	}
	return { ...here, tokens: new Set((passageParts(parts, highlight.text) ?? []).map((i) => keys[i]).filter(Boolean)) };
}

/** Where the Tutor's turn goes: right after the Highlight, which may be in the middle of a Sentence. */
export interface TurnPlace {
	/** The paragraph holding the Highlight's end (0-based). */
	paragraph: number;
	/** The Sentence, within that paragraph, the Highlight ends in. */
	sentence: number;
	/** The token of that Sentence the turn follows; its last means the turn follows the whole Sentence. */
	token: number;
}

/**
 * Where the Tutor's turn goes among `paragraphs`, given where the Highlight falls on this Page: after
 * its passage's last token (and the punctuation stuck to it), or after its last whole Sentence.
 */
export function turnPlace(
	paragraphs: { sentences: { tokens: { text: string }[] }[] }[],
	here: HighlightOnPage | undefined
): TurnPlace | undefined {
	if (!here || here.sentences.size === 0) return undefined;
	const last = Math.max(...here.sentences);
	let start = 0;
	for (let p = 0; p < paragraphs.length; p++) {
		const end = start + paragraphs[p].sentences.length;
		if (last < end) {
			const tokens = paragraphs[p].sentences[last - start].tokens;
			let token = tokens.length - 1;
			const inPassage = tokens.map((_, t) => t).filter((t) => here.tokens?.has(`${last}:${t}`));
			if (inPassage.length > 0) {
				token = Math.max(...inPassage);
				// A comma or full stop stays with the passage rather than opening the line after the turn.
				while (token + 1 < tokens.length && /^[^\s\p{L}\p{N}]/u.test(tokens[token + 1].text)) token++;
			}
			return { paragraph: p, sentence: last - start, token };
		}
		start = end;
	}
	return undefined;
}
