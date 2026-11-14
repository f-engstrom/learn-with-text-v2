/** How Page texts are cut and joined while editing a Book, the same in the browser and on the server. */

/** Creating a Book ends a Page at the first Sentence after this many Words. */
export const PAGE_WORD_TARGET = 250;

/** A Page more than twice that is "longer than usual" on the edit screen. */
export const LONG_PAGE_WORDS = PAGE_WORD_TARGET * 2;

/** A line containing only `---`, which starts a new Page. */
export const PAGE_BREAK_LINE = /^[ \t]*---[ \t]*$/m;

/** The parts a `---` line cuts a text into, blank ones dropped. */
export function splitAtBreaks(text: string): string[] {
	return text
		.replace(/\r\n?/g, '\n')
		.split(PAGE_BREAK_LINE)
		.map((part) => part.trim())
		.filter((part) => part !== '');
}

/** Two Pages' texts as one: a Page cut off mid-sentence goes on in the same paragraph. */
export function joinTexts(first: string, second: string): string {
	const head = first.trimEnd();
	return `${head}${/[.!?…»"”:)\]]$/u.test(head) ? '\n\n' : ' '}${second.trimStart()}`;
}
