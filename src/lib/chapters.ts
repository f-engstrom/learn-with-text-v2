/** How a Chapter is named and written, the same in the browser and on the server (ADR 0009). */

/** A Chapter's name on the screen: its title, or "Chapter n" when it has none. */
export function chapterLabel(title: string, number: number): string {
	return title === '' ? `Chapter ${number}` : title;
}

/** A Chapter title as stored: one line, its spaces collapsed. */
export function cleanChapterTitle(title: string): string {
	return title.replace(/\s+/g, ' ').trim();
}

/**
 * A line starting with `# ` in a text being imported starts a Chapter, the line its title; it stays
 * in the text without the `#`. Lines like it straight after it add to the title, after a ` · `.
 */
export const CHAPTER_LINE = /^#[ \t]+(\S.*)$/;
