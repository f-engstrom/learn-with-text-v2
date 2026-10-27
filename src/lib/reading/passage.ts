// Finding a Highlight's passage in the text, shared by the Reader's check and the reading screen.

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
