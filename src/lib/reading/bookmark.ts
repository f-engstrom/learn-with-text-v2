// The Bookmark's Word, shared by the reading screen and the Tutor's tools so both find the same one.

/** The Word (or Multi-word Term) in a Sentence's tokens that is the Bookmark's Word: same text, any case. */
export function bookmarkedWord<T extends { text: string; key?: string }>(
	tokens: T[],
	word: string | undefined,
	languageCode: string
): T | undefined {
	if (!word) return undefined;
	const wanted = word.toLocaleLowerCase(languageCode);
	return tokens.find((t) => t.key !== undefined && t.text.toLocaleLowerCase(languageCode) === wanted);
}
