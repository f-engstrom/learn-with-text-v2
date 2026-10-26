/** Where a Word sits on the Page: the index of its Sentence. */
export interface WordPosition {
	sentence: number;
}

/**
 * The Word to move to. With no current Word, moving forward starts at the first Word and moving
 * back at the last. Moving by Sentence goes to the first Word of the next Sentence, or back to the
 * start of the current Sentence (then the previous one), like a text editor.
 */
export function moveCursor(
	words: WordPosition[],
	current: number | undefined,
	command: { kind: 'move' | 'sentence'; by: 1 | -1 }
): number | undefined {
	if (words.length === 0) return undefined;
	if (current === undefined) return command.by > 0 ? 0 : words.length - 1;

	if (command.kind === 'move') return Math.min(Math.max(current + command.by, 0), words.length - 1);

	const sentence = words[current].sentence;
	const startOf = (s: number) => words.findIndex((w) => w.sentence === s);
	if (command.by > 0) {
		const next = words.findIndex((w) => w.sentence > sentence);
		return next === -1 ? current : next;
	}
	const start = startOf(sentence);
	if (current > start) return start;
	const previous = words.findLast((w) => w.sentence < sentence);
	return previous ? startOf(previous.sentence) : current;
}
