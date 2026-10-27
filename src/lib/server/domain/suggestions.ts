import type { Kysely } from 'kysely';
import { DEFAULT_FIT_RANGE, type FitRange, type Suggestion } from '../../suggestions';
import type { Database } from '../db/schema';
import { createBook, PAGE_WORD_TARGET, splitIntoPages } from './books';
import type { Language } from './languages';
import { countWords, normalise, parserFor, type Parser } from './parsing';
import { listTopics } from './topics';

export type { FitRange, Suggestion } from '../../suggestions';

/** An article, as plain text with `== Heading ==` lines between sections. */
export interface Article {
	title: string;
	url: string;
	text: string;
}

/** The Wikipedia seam: the real one fetches from wikipedia.org, tests use a fake. */
export interface WikipediaSource {
	/** Searches English Wikipedia and follows each result's link to the Language's Wikipedia. */
	search(topic: string, languageCode: string, limit: number): Promise<string[]>;
	/** Random article titles from the Language's Wikipedia. */
	random(languageCode: string, limit: number): Promise<string[]>;
	article(languageCode: string, title: string): Promise<Article | undefined>;
}

/** How many Suggestions to look for at once. */
export const SUGGESTION_COUNT = 12;
/** Articles shorter than this (after cutting) are stubs, not reading material. */
export const MIN_WORDS = 80;

/** A Suggestion with the text a Book would get. */
export interface Candidate extends Suggestion {
	text: string;
}

/** Section headings where an article's reading text ends: references, links, "see also". */
const END_MATTER =
	/^(references|notes|see also|external links|further reading|sources|примечания|литература|ссылки|см\. также|источники|reference|izvori|literatura|vanjski linkovi|vanjske veze|također pogledajte|vidi još|bilješke|منابع|پانویس|جستارهای وابسته|پیوند به بیرون|یادداشت‌ها|参考文献|参考资料|外部链接|外部連結|参见|參見|注释|註釋)$/i;

/**
 * Cuts an article to at most about three Pages: the lead, then further sections while it is under
 * two Pages, stopping at the paragraph that would go past three, and nothing from the references
 * onwards. A lead paragraph is always kept. Headings become their own lines.
 */
export function cutArticle(text: string, parser: Parser, wordTarget = PAGE_WORD_TARGET): string {
	const sections: { heading?: string; paragraphs: string[] }[] = [{ paragraphs: [] }];
	for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
		const heading = line.match(/^\s*=+\s*(.*?)\s*=+\s*$/);
		if (heading) sections.push({ heading: heading[1], paragraphs: [] });
		else if (line.trim() !== '') sections.at(-1)!.paragraphs.push(line.trim());
	}

	const kept: { text: string; heading: boolean }[] = [];
	let total = 0;
	for (const [i, section] of sections.entries()) {
		if (i > 0 && total >= 2 * wordTarget) break;
		if (section.heading !== undefined && END_MATTER.test(section.heading)) break;
		if (section.heading) kept.push({ text: section.heading, heading: true });
		for (const paragraph of section.paragraphs) {
			const words = countWords(parser.parse(paragraph));
			if (total > 0 && total + words > 3 * wordTarget) break;
			kept.push({ text: paragraph, heading: false });
			total += words;
		}
	}
	// Headings left at the end, with nothing under them, are dropped.
	while (kept.at(-1)?.heading) kept.pop();
	return kept.map((k) => k.text).join('\n');
}

/** The share of a text's distinct Words that are Unknown in a Language, from 0 to 1. */
export async function unknownShareOf(db: Kysely<Database>, language: Language, text: string): Promise<number> {
	const words = new Set(
		parserFor(language)
			.parse(text)
			.flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t) => t.isWord).map((t) => normalise(t.text, language))))
	);
	if (words.size === 0) return 0;
	const known = await db
		.selectFrom('term')
		.select((eb) => eb.fn.countAll<number>().as('n'))
		.where('language_id', '=', language.id)
		.where('normalised', 'in', [...words])
		.executeTakeFirstOrThrow();
	return (words.size - Number(known.n)) / words.size;
}

export async function getFitRange(db: Kysely<Database>, languageId: number): Promise<FitRange> {
	const row = await db.selectFrom('language').select(['fit_min', 'fit_max']).where('id', '=', languageId).executeTakeFirst();
	return row ? { min: row.fit_min, max: row.fit_max } : DEFAULT_FIT_RANGE;
}

/** Remembers a Language's Fit range; the ends are put in order and kept between 0 and 1. */
export async function setFitRange(db: Kysely<Database>, languageId: number, range: FitRange): Promise<FitRange> {
	const clamp = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), 1);
	const [min, max] = [clamp(range.min), clamp(range.max)].toSorted((a, b) => a - b);
	await db.updateTable('language').set({ fit_min: min, fit_max: max }).where('id', '=', languageId).execute();
	return { min, max };
}

/**
 * Looks for things to read in a Language: articles for your Topics, or random ones if you have
 * none. Articles you already have as a Book and stubs are left out. Not ranked; see rankSuggestions.
 */
export async function findSuggestions(db: Kysely<Database>, source: WikipediaSource, language: Language): Promise<Candidate[]> {
	const topics = await listTopics(db);
	let found: { title: string; topic?: string }[];
	const failures: unknown[] = [];
	if (topics.length > 0) {
		const perTopic = await Promise.allSettled(
			topics.map(async (t) => shuffle(await source.search(t.text, language.code, 20)).map((title) => ({ title, topic: t.text })))
		);
		found = interleave(perTopic.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : (failures.push(r.reason), []))));
	} else {
		found = (await source.random(language.code, SUGGESTION_COUNT * 2)).map((title) => ({ title }));
	}
	found = found.filter((f, i) => found.findIndex((g) => g.title === f.title) === i).slice(0, SUGGESTION_COUNT * 2);

	const parser = parserFor(language);
	const candidates: Candidate[] = [];
	// Two at a time, to stay well inside Wikipedia's rate limits.
	await eachLimited(found, 2, async ({ title, topic }) => {
		if (candidates.length >= SUGGESTION_COUNT) return;
		let article: Article | undefined;
		try {
			article = await source.article(language.code, title);
		} catch (e) {
			failures.push(e);
			return;
		}
		if (!article) return;
		const text = cutArticle(article.text, parser);
		if (countWords(parser.parse(text)) < MIN_WORDS) return;
		candidates.push({
			title: article.title,
			url: article.url,
			topic,
			text,
			unknownShare: await unknownShareOf(db, language, text),
			pageCount: splitIntoPages(text, parser).length
		});
	});

	// Some failures are fine; a search that found nothing because every request failed is not.
	if (candidates.length === 0 && failures.length > 0) throw failures[0];

	const urls = candidates.map((c) => c.url);
	const have = new Set(
		urls.length === 0 ? [] : (await db.selectFrom('book').select('url').where('url', 'in', urls).execute()).map((b) => b.url)
	);
	return candidates.filter((c) => !have.has(c.url));
}

/** Imports an article as a Book that keeps its address; one you already have is reused. */
export async function importArticle(
	db: Kysely<Database>,
	source: WikipediaSource,
	language: Language,
	title: string
): Promise<number | undefined> {
	const article = await source.article(language.code, title);
	if (!article) return undefined;
	const existing = await db.selectFrom('book').select('id').where('url', '=', article.url).executeTakeFirst();
	if (existing) return existing.id;
	return createBook(db, {
		languageId: language.id,
		title: article.title,
		text: cutArticle(article.text, parserFor(language)),
		url: article.url
	});
}

function shuffle<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

/** Takes one from each list in turn, so every Topic gets a share. */
function interleave<T>(lists: T[][]): T[] {
	const out: T[] = [];
	for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
	return out;
}

async function eachLimited<T>(items: T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (next < items.length) await run(items[next++]);
		})
	);
}

const USER_AGENT = 'Reader/0.1 (personal language-learning app; Suggestions)';
/** Wikipedias that mix scripts; their text is converted to one. */
const variants: Record<string, string> = { zh: 'zh-cn' };

/** Fetches from Wikipedia's API, keeping articles in memory so picking one doesn't fetch it again. */
export function wikipediaFromWeb(fetchFn: typeof fetch = fetch, cacheSize = 200): WikipediaSource {
	const articles = new Map<string, Promise<Article | undefined>>();
	const api = async (code: string, params: Record<string, string>) => {
		const query = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params });
		if (variants[code]) query.set('variant', variants[code]);
		const response = await fetchFn(`https://${code}.wikipedia.org/w/api.php?${query}`, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`Wikipedia answered ${response.status}`);
		return response.json();
	};
	return {
		async search(topic, code, limit) {
			const body = await api('en', {
				generator: 'search',
				gsrsearch: topic,
				gsrnamespace: '0',
				gsrlimit: String(limit),
				prop: 'langlinks',
				lllang: code,
				lllimit: 'max'
			});
			const pages: { langlinks?: { title: string }[] }[] = body.query?.pages ?? [];
			return pages.flatMap((p) => p.langlinks?.map((l) => l.title) ?? []);
		},
		async random(code, limit) {
			const body = await api(code, { list: 'random', rnnamespace: '0', rnlimit: String(limit) });
			return (body.query?.random ?? []).map((p: { title: string }) => p.title);
		},
		article(code, title) {
			const key = `${code}:${title}`;
			let hit = articles.get(key);
			if (!hit) {
				hit = api(code, {
					prop: 'extracts|info',
					inprop: 'url',
					explaintext: '1',
					exsectionformat: 'wiki',
					redirects: '1',
					titles: title
				}).then((body) => {
					const page = body.query?.pages?.[0];
					if (!page || page.missing || !page.extract) return undefined;
					return { title: page.title, url: page.fullurl, text: page.extract };
				});
				hit.catch(() => articles.delete(key));
				articles.set(key, hit);
				if (articles.size > cacheSize) articles.delete(articles.keys().next().value!);
			}
			return hit;
		}
	};
}
