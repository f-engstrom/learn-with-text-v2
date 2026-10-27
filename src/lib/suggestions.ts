// Shared with the browser, which re-ranks Suggestions when you move the Fit range.

/** The range of Unknown share (0 to 1) a Suggestion should fall in. */
export interface FitRange {
	min: number;
	max: number;
}

export const DEFAULT_FIT_RANGE: FitRange = { min: 0.05, max: 0.15 };

export interface Suggestion {
	title: string;
	/** The article's web address. */
	url: string;
	/** The Topic it was found for; none for a random article. */
	topic?: string;
	unknownShare: number;
	pageCount: number;
}

export const fits = (s: Pick<Suggestion, 'unknownShare'>, range: FitRange) => s.unknownShare >= range.min && s.unknownShare <= range.max;

/** One to three Pages reads in a sitting. */
export const goodLength = (s: Pick<Suggestion, 'pageCount'>) => s.pageCount >= 1 && s.pageCount <= 3;

/** How far outside the Fit range a share is; 0 inside it. */
const distance = (s: Suggestion, range: FitRange) => Math.max(range.min - s.unknownShare, s.unknownShare - range.max, 0);

/**
 * Best first: inside the Fit range, then found for a Topic, then one to three Pages long;
 * ties go to the one closest to the Fit range, then the easiest.
 */
export function rankSuggestions<S extends Suggestion>(suggestions: S[], range: FitRange): S[] {
	const key = (s: S) => [fits(s, range) ? 0 : 1, s.topic ? 0 : 1, goodLength(s) ? 0 : 1, distance(s, range), s.unknownShare];
	return suggestions.toSorted((a, b) => {
		const [ka, kb] = [key(a), key(b)];
		const i = ka.findIndex((v, j) => v !== kb[j]);
		return i === -1 ? 0 : ka[i] - kb[i];
	});
}
