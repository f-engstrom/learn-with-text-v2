import type { DictionaryDisplay } from '#lib/server/db/schema.ts';

// Shared with the browser, which builds the lookup address for the selected Word or phrase.

export interface Dictionary {
	id: number;
	name: string;
	/** Address with a `[TERM]` placeholder. */
	url: string;
	display: DictionaryDisplay;
}

/** The address to look up a Term: `[TERM]` replaced with its (encoded) Normalised form. */
export function lookupUrl(dictionary: Pick<Dictionary, 'url'>, normalised: string): string {
	return dictionary.url.replaceAll('[TERM]', encodeURIComponent(normalised));
}

/**
 * Whether a configured Dictionary is a Wiktionary page. The reading screen's load hands it over apart
 * from the others, and the Dictionary panel's Wiktionary tab shows it beneath its suggestions.
 */
export function isWiktionary(dictionary: Pick<Dictionary, 'url' | 'display'>): boolean {
	if (dictionary.display !== 'embedded') return false;
	try {
		return /(^|\.)wiktionary\.org$/.test(new URL(dictionary.url.replaceAll('[TERM]', 'x')).hostname);
	} catch {
		return false;
	}
}
