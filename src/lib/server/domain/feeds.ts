import type { Kysely } from 'kysely';
import { DOMParser } from 'linkedom';
import type { Database } from '../db/schema';
import { fetchArticle, InvalidAddress, type WebArticle } from './webpages';

export interface Feed {
	id: number;
	languageId: number;
	name: string;
	url: string;
}

export interface FeedItem {
	title: string;
	url: string;
	published?: Date;
}

export class InvalidFeed extends Error {}

/** Bidirectional control characters some feeds put in their names (e.g. BBC Persian). */
const BIDI_CONTROLS = /[‪-‮⁦-⁩]/g;
const clean = (text: string | null | undefined) => (text ?? '').replace(BIDI_CONTROLS, '').replace(/\s+/g, ' ').trim();

/** Reads an RSS 2.0, RSS 1.0 (RDF) or Atom feed: its title and items, newest first. */
export function parseFeed(xml: string): { title: string; items: FeedItem[] } {
	const document = new DOMParser().parseFromString(xml, 'text/xml');
	// linkedom's types aren't the DOM's; its elements behave the same.
	const root = document.documentElement as unknown as Element | null;
	if (!root || !/^(rss|rdf:rdf|feed)$/i.test(root.tagName)) throw new InvalidFeed("That isn't an RSS or Atom feed.");

	const child = (el: Element, name: string) => [...el.children].find((c) => c.tagName.toLowerCase() === name);
	const channel = child(root, 'channel') ?? root;
	const entries = [...document.querySelectorAll('item, entry')] as unknown as Element[];
	const items = entries.flatMap((entry): FeedItem[] => {
		const linkEl = child(entry, 'link');
		// Atom gives the address in href; RSS in the element's text.
		const url = clean(linkEl?.getAttribute('href') || linkEl?.textContent || child(entry, 'guid')?.textContent);
		if (!/^https?:\/\//.test(url)) return [];
		const date = clean(
			(child(entry, 'pubdate') ?? child(entry, 'dc:date') ?? child(entry, 'published') ?? child(entry, 'updated'))?.textContent
		);
		const published = date ? new Date(date) : undefined;
		return [{ title: clean(child(entry, 'title')?.textContent), url, published: published && !isNaN(+published) ? published : undefined }];
	});
	items.sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0));
	return { title: clean(child(channel, 'title')?.textContent), items };
}

export async function listFeeds(db: Kysely<Database>, languageId?: number): Promise<Feed[]> {
	let query = db.selectFrom('feed').select(['id', 'language_id as languageId', 'name', 'url']).orderBy('language_id').orderBy('name');
	if (languageId !== undefined) query = query.where('language_id', '=', languageId);
	return query.execute();
}

/**
 * Adds a Feed after reading it once, to check it is a feed with items. Without a name, the
 * feed's own title is used.
 */
export async function addFeed(
	db: Kysely<Database>,
	readFeed: (url: string) => Promise<string>,
	input: { languageId: number; url: string; name?: string }
): Promise<number> {
	let url: URL;
	try {
		url = new URL(input.url.trim());
	} catch {
		throw new InvalidFeed('That is not a web address. It should start with https://');
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new InvalidFeed('Only http and https feeds can be read.');
	const existing = await db
		.selectFrom('feed')
		.select('id')
		.where('language_id', '=', input.languageId)
		.where('url', '=', url.href)
		.executeTakeFirst();
	if (existing) throw new InvalidFeed('That Feed is already there.');

	let xml: string;
	try {
		xml = await readFeed(url.href);
	} catch {
		throw new InvalidFeed("Couldn't read that address.");
	}
	const feed = parseFeed(xml);
	if (feed.items.length === 0) throw new InvalidFeed('That feed has no items.');
	const row = await db
		.insertInto('feed')
		.values({ language_id: input.languageId, url: url.href, name: clean(input.name) || feed.title || url.hostname })
		.returning('id')
		.executeTakeFirstOrThrow();
	return row.id;
}

export async function removeFeed(db: Kysely<Database>, id: number): Promise<void> {
	await db.deleteFrom('feed').where('id', '=', id).execute();
}

/** The Feed seam for Suggestions: the real one reads the web, tests use a fake. */
export interface FeedReader {
	items(feedUrl: string): Promise<FeedItem[]>;
	/** The article at an item's address, or undefined if it has none. */
	article(url: string): Promise<WebArticle | undefined>;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; Reader/0.1; personal language-learning app)';

/** Reads a feed's XML from the web. */
export async function readFeedText(url: string, fetchFn: typeof fetch = fetch): Promise<string> {
	const response = await fetchFn(url, {
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new InvalidFeed(`The feed answered ${response.status}.`);
	return response.text();
}

/** Reads Feeds and their articles from the web, keeping articles in memory so picking one doesn't fetch it again. */
export function feedsFromWeb(fetchFn: typeof fetch = fetch, cacheSize = 200): FeedReader {
	const articles = new Map<string, Promise<WebArticle | undefined>>();
	return {
		items: async (feedUrl) => parseFeed(await readFeedText(feedUrl, fetchFn)).items,
		article(url) {
			let hit = articles.get(url);
			if (!hit) {
				hit = fetchArticle(url, fetchFn).catch((e) => {
					articles.delete(url);
					// A page without an article is simply not a Suggestion.
					if (e instanceof InvalidAddress) return undefined;
					throw e;
				});
				articles.set(url, hit);
				if (articles.size > cacheSize) articles.delete(articles.keys().next().value!);
			}
			return hit;
		}
	};
}
