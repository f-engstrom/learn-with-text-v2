// Shared with the browser, which counts the Words of a Page while a Book is edited.

/** A piece of text: a Word, or the punctuation and spaces between Words. */
export interface Token {
	text: string;
	isWord: boolean;
}

const hasLetter = /\p{L}/u;
/** A hyphen inside a Word: hyphen-minus, hyphen, non-breaking hyphen. Dashes split Words. */
const hyphen = /^[-‐‑]$/u;

/**
 * Splits text into Words and what lies between them with ICU's word segmentation (ADR 0002).
 * Numbers are not Words. Words joined by a single hyphen are one Word (почему-то, anak-anak).
 */
export function wordTokens(segmenter: Intl.Segmenter, text: string): Token[] {
	const tokens: Token[] = [...segmenter.segment(text)].map((s) => ({
		text: s.segment,
		isWord: s.isWordLike === true && hasLetter.test(s.segment)
	}));
	const joined: Token[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const previous = joined.at(-1);
		const next = tokens[i + 1];
		if (previous?.isWord && hyphen.test(tokens[i].text) && next?.isWord) {
			previous.text += tokens[i].text + next.text;
			i++;
		} else {
			joined.push({ ...tokens[i] });
		}
	}
	return joined;
}

const segmenters = new Map<string, Intl.Segmenter>();

/** The word segmenter for a Language's code, made once. */
export function wordSegmenter(code: string): Intl.Segmenter {
	let segmenter = segmenters.get(code);
	if (!segmenter) segmenters.set(code, (segmenter = new Intl.Segmenter(code, { granularity: 'word' })));
	return segmenter;
}
