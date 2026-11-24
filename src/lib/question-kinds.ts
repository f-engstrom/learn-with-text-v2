/**
 * The kinds of the Tutor's question beyond typed and picked (order, gaps, match), shared by the domain, which checks
 * them, and the question card, which draws them. Each is answered with one line of text, so `Answer` stays a list
 * of strings and the Tutor reads it like any other.
 */

/** A gap in a sentence for a `gaps` question. */
export const gapMark = '___';

/** A string's own seed, so a question is shuffled the same way every time it is drawn. */
function seedOf(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
	return h >>> 0;
}

/** The indexes 0…n−1 in an order fixed by the seed, never the order they came in (when there are two or more). */
export function shuffledIndexes(n: number, seed: string): number[] {
	let state = seedOf(seed) || 1;
	const random = () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0) / 2 ** 32;
	};
	const order = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	// Shown in the order that is right, the question would answer itself: turn it by one.
	if (n > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
	return order;
}

/** The parts of a `gaps` text around its gaps: one more than there are gaps. */
export const gapParts = (text: string): string[] => text.split(gapMark);

/** The words in the order the learner put them. */
export const orderAnswer = (words: string[]): string => words.join(' ');

/** The sentence with the learner's words in its gaps, each in [brackets] so the Tutor sees what they wrote. */
export const gapsAnswer = (text: string, fills: string[]): string =>
	gapParts(text)
		.map((part, i) => part + (i < fills.length ? `[${fills[i].trim()}]` : ''))
		.join('');

/** Each on the left with what the learner matched it with, one pair to a line. */
export const matchAnswer = (left: string[], matched: string[]): string => left.map((l, i) => `${l} = ${matched[i]}`).join('\n');
