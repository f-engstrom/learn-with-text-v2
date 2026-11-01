import type { Language } from '#lib/server/domain/languages.ts';

type Rules = Pick<Language, 'code' | 'characterMap'>;

// Shared with the browser, which works out the Normalised form of a phrase you select.

/** The Normalised form used for matching: the Language's character map applied, then lowercased. */
export function normalise(text: string, language: Rules): string {
	let mapped = '';
	for (const ch of text.normalize('NFC')) {
		mapped += Object.hasOwn(language.characterMap, ch) ? language.characterMap[ch] : ch;
	}
	return mapped.toLocaleLowerCase(language.code).normalize('NFC');
}

/**
 * The Normalised form of a Term: of one Word, or of several with only whitespace (or nothing)
 * between them. Any run of whitespace counts as one space, so a phrase matches however it is spaced,
 * and Words written together (e.g. Chinese) match whether or not the segmenter split them.
 */
export function termKey(text: string, language: Rules): string {
	return normalise(text.trim().replace(/\s+/gu, ' '), language);
}

const han = /^\p{Script=Han}$/u;

/**
 * The characters of a Word written in Chinese characters, if it has more than one: the segmenter can
 * join characters you want as Terms of their own (我的 → 我), so any run of them can be selected.
 */
export function characterParts(text: string): string[] | undefined {
	const characters = [...text];
	return characters.length > 1 && characters.every((c) => han.test(c)) ? characters : undefined;
}

/** Every run of characters within a Word's `characterParts`, shorter than the Word itself. */
export function partKeys(key: string): string[] {
	const characters = characterParts(key);
	if (!characters) return [];
	const parts: string[] = [];
	for (let start = 0; start < characters.length; start++) {
		for (let end = start + 1; end <= characters.length; end++) {
			if (end - start < characters.length) parts.push(characters.slice(start, end).join(''));
		}
	}
	return parts;
}
