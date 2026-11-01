import type { Language } from './languages';

/** One part of speech of Azure's answer, its translations most likely first. */
export interface AzureEntry {
	/** Empty for a plain machine translation. */
	partOfSpeech: string;
	translations: string[];
}

export interface AzureResult {
	/** 'dictionary' when Azure knows the Word, 'translation' when it only machine-translated it. */
	kind: 'dictionary' | 'translation';
	entries: AzureEntry[];
}

/** The dictionary lookup API's shape, for one text. */
export type RawLookup = { translations: { displayTarget: string; posTag: string }[] };

/** The Azure Translator seam: the real one calls the API, tests use a fake. */
export interface AzureSource {
	lookup(from: string, text: string): Promise<RawLookup>;
	/** The text translated to English. */
	translate(from: string, text: string): Promise<string>;
}

/** Azure's codes where they differ from the Language's. */
const codes: Record<string, string> = { zh: 'zh-Hans' };

const partsOfSpeech: Record<string, string> = {
	ADJ: 'adjective',
	ADV: 'adverb',
	CONJ: 'conjunction',
	DET: 'determiner',
	MODAL: 'modal verb',
	NOUN: 'noun',
	PREP: 'preposition',
	PRON: 'pronoun',
	VERB: 'verb',
	OTHER: 'other'
};

/**
 * Azure's English translations of a Term: dictionary entries for a Word it knows, grouped by part of
 * speech, else a machine translation of the text as written (phrases go straight to that).
 */
export async function lookUp(
	source: AzureSource,
	language: Pick<Language, 'code'>,
	term: { normalised: string; text: string }
): Promise<AzureResult | undefined> {
	const from = codes[language.code] ?? language.code;
	const text = term.text.trim() || term.normalised;
	if (text === '') return undefined;
	if (!/\s/.test(text)) {
		const entries: AzureEntry[] = [];
		for (const t of (await source.lookup(from, term.normalised || text)).translations) {
			const partOfSpeech = partsOfSpeech[t.posTag] ?? t.posTag.toLowerCase();
			const entry = entries.find((e) => e.partOfSpeech === partOfSpeech);
			if (!entry) entries.push({ partOfSpeech, translations: [t.displayTarget] });
			else if (!entry.translations.includes(t.displayTarget)) entry.translations.push(t.displayTarget);
		}
		if (entries.length > 0) return { kind: 'dictionary', entries };
	}
	const translated = (await source.translate(from, text)).trim();
	return translated === '' ? undefined : { kind: 'translation', entries: [{ partOfSpeech: '', translations: [translated] }] };
}

/** Calls Azure Translator with the resource's key and region, keeping recent answers in memory. */
export function azureFromWeb(key: string, region: string, fetchFn: typeof fetch = fetch, cacheSize = 500): AzureSource {
	const cache = new Map<string, Promise<unknown>>();
	const cached = <T>(cacheKey: string, load: () => Promise<T>): Promise<T> => {
		let hit = cache.get(cacheKey) as Promise<T> | undefined;
		if (!hit) {
			hit = load();
			// A failed request isn't kept, so the next lookup tries again.
			hit.catch(() => cache.delete(cacheKey));
			cache.set(cacheKey, hit);
			if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
		}
		return hit;
	};
	const post = async (path: string, from: string, text: string) => {
		const response = await fetchFn(`https://api.cognitive.microsofttranslator.com/${path}?api-version=3.0&from=${from}&to=en`, {
			method: 'POST',
			headers: { 'Ocp-Apim-Subscription-Key': key, 'Ocp-Apim-Subscription-Region': region, 'Content-Type': 'application/json' },
			body: JSON.stringify([{ Text: text }])
		});
		if (!response.ok) throw new Error(`Azure Translator answered ${response.status}`);
		return (await response.json())[0];
	};
	return {
		lookup: (from, text) => cached(`l:${from}:${text}`, () => post('dictionary/lookup', from, text)),
		translate: (from, text) =>
			cached(`t:${from}:${text}`, async () => ((await post('translate', from, text))?.translations?.[0]?.text as string) ?? '')
	};
}
