import type { Language } from './languages';

/** One part of speech of a Wiktionary entry, with its definitions as plain text. */
export interface WiktionaryEntry {
	partOfSpeech: string;
	definitions: string[];
}

export interface WiktionaryResult {
	/** The page the definitions came from, e.g. 喜歡 for 喜欢. */
	title: string;
	entries: WiktionaryEntry[];
}

/** The definition API's shape: entries per Wiktionary language code. */
export type RawDefinitions = Record<string, { partOfSpeech: string; definitions: { definition: string }[] }[]>;

/** The Wiktionary seam: the real one fetches from en.wiktionary.org, tests use a fake. */
export interface WiktionarySource {
	/** The page's definitions, or undefined if there is no such page. */
	definitions(title: string): Promise<RawDefinitions | undefined>;
	/** The page's wikitext, or undefined if there is no such page. */
	wikitext(title: string): Promise<string | undefined>;
}

/** The Wiktionary language sections for each Language (Bosnian is under Serbo-Croatian). */
const sections: Record<string, string> = { bs: 'sh', fa: 'fa', ru: 'ru', zh: 'zh' };

/**
 * English Wiktionary's definitions of a Term in its Language. Tries the Normalised form, then the
 * text as written (for names); a simplified Chinese page that only points to its traditional form
 * (`{{zh-see|喜歡}}`) is followed there.
 */
export async function lookUp(
	source: WiktionarySource,
	language: Pick<Language, 'code'>,
	term: { normalised: string; text: string }
): Promise<WiktionaryResult | undefined> {
	const section = sections[language.code] ?? language.code;
	const titles = [...new Set([term.normalised, term.text.trim()])].filter((t) => t !== '');
	for (const title of titles) {
		const entries = toEntries((await source.definitions(title))?.[section]);
		if (entries.length > 0) return { title, entries };
		if (language.code === 'zh') {
			const target = (await source.wikitext(title))?.match(/\{\{zh-see\|([^|}]+)/)?.[1]?.trim();
			const followed = target ? toEntries((await source.definitions(target))?.[section]) : [];
			if (target && followed.length > 0) return { title: target, entries: followed };
		}
	}
	return undefined;
}

function toEntries(raw: RawDefinitions[string] | undefined): WiktionaryEntry[] {
	return (raw ?? [])
		.map((e) => ({ partOfSpeech: e.partOfSpeech, definitions: e.definitions.map((d) => plainText(d.definition)).filter((d) => d !== '') }))
		.filter((e) => e.definitions.length > 0);
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** A definition's HTML as plain text: tags removed, entities decoded, spacing tidied. */
export function plainText(html: string): string {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
			if (name.startsWith('#x') || name.startsWith('#X')) return String.fromCodePoint(parseInt(name.slice(2), 16));
			if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
			return entities[name.toLowerCase()] ?? match;
		})
		.replace(/\s+/g, ' ')
		.replace(/\(\s+/g, '(')
		.replace(/\s+([),;.:])/g, '$1')
		.trim();
}

const USER_AGENT = 'Reader/0.1 (personal language-learning app; Wiktionary panel)';

/** Fetches from English Wiktionary, keeping recent answers in memory. */
export function wiktionaryFromWeb(fetchFn: typeof fetch = fetch, cacheSize = 500): WiktionarySource {
	const cache = new Map<string, Promise<unknown>>();
	const cached = <T>(key: string, load: () => Promise<T>): Promise<T> => {
		let hit = cache.get(key) as Promise<T> | undefined;
		if (!hit) {
			hit = load();
			// A failed request isn't kept, so the next lookup tries again.
			hit.catch(() => cache.delete(key));
			cache.set(key, hit);
			if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
		}
		return hit;
	};
	const get = async (url: string) => {
		const response = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
		if (response.status === 404) return undefined;
		if (!response.ok) throw new Error(`Wiktionary answered ${response.status}`);
		return response.json();
	};
	const page = (title: string) => encodeURIComponent(title.replaceAll(' ', '_'));
	return {
		definitions: (title) =>
			cached(`d:${title}`, () => get(`https://en.wiktionary.org/api/rest_v1/page/definition/${page(title)}`)),
		wikitext: (title) =>
			cached(`w:${title}`, async () => {
				const body = await get(
					`https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&page=${page(title)}`
				);
				return body?.parse?.wikitext as string | undefined;
			})
	};
}
