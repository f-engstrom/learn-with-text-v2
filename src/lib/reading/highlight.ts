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
