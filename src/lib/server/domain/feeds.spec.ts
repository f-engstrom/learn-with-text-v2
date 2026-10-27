import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listBooks } from './books';
import { addFeed, InvalidFeed, listFeeds, parseFeed, removeFeed, type FeedReader } from './feeds';
import { listLanguages } from './languages';
import { findSuggestions, importFeedItem, ITEMS_PER_FEED, type WikipediaSource } from './suggestions';

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>BBC &#8238;فارسی</title>
<item><title>Older</title><link>https://news.example/older</link><pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate></item>
<item><title><![CDATA[Newer & better]]></title><link>https://news.example/newer</link><pubDate>Tue, 27 Oct 2026 08:00:00 GMT</pubDate></item>
<item><title>No address</title></item>
</channel></rss>`;

const rdf = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel rdf:about="https://dw.example/"><title>DW</title><link>https://dw.example/</link></channel>
<item rdf:about="https://dw.example/a"><title>A</title><link>https://dw.example/a</link><dc:date>2026-10-27T10:00:00Z</dc:date></item>
</rdf:RDF>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom news</title>
<entry><title>Entry</title><link rel="alternate" href="https://atom.example/entry"/><updated>2026-10-27T09:00:00Z</updated></entry>
</feed>`;

describe('parseFeed', () => {
	it('reads RSS: the title without direction marks, items with an address, newest first', () => {
		const feed = parseFeed(rss);
		expect(feed.title).toBe('BBC فارسی');
		expect(feed.items.map((i) => [i.title, i.url])).toEqual([
			['Newer & better', 'https://news.example/newer'],
			['Older', 'https://news.example/older']
		]);
		expect(feed.items[0].published?.toISOString()).toBe('2026-10-27T08:00:00.000Z');
	});

	it('reads RDF and Atom feeds', () => {
		expect(parseFeed(rdf)).toMatchObject({ title: 'DW', items: [{ title: 'A', url: 'https://dw.example/a' }] });
		expect(parseFeed(atom)).toMatchObject({ title: 'Atom news', items: [{ title: 'Entry', url: 'https://atom.example/entry' }] });
	});

	it('rejects what is not a feed', () => {
		expect(() => parseFeed('<html><body>Hello</body></html>')).toThrow(InvalidFeed);
	});
});

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const languages = await listLanguages(db);
	const farsi = languages.find((l) => l.code === 'fa')!;
	return { db, farsi, languages };
}

describe('Feeds', () => {
	it('are seeded for every Language', async () => {
		const { db, languages } = await setup();
		for (const language of languages) expect((await listFeeds(db, language.id)).length, language.name).toBeGreaterThan(0);
		const { farsi } = await setup();
		expect((await listFeeds(db, farsi.id)).map((f) => f.name)).toEqual(['BBC Persian', 'DW Persian']);
	});

	it("are added after reading them once, named after the feed's title unless you name them", async () => {
		const { db, farsi } = await setup();
		await addFeed(db, async () => rss, { languageId: farsi.id, url: 'https://news.example/rss' });
		await addFeed(db, async () => atom, { languageId: farsi.id, url: 'https://atom.example/feed', name: ' Mine ' });
		const names = (await listFeeds(db, farsi.id)).map((f) => f.name);
		expect(names).toContain('BBC فارسی');
		expect(names).toContain('Mine');
	});

	it('refuse an address that is not a feed, has no items, or is already there', async () => {
		const { db, farsi } = await setup();
		const add = (url: string, xml: string) => addFeed(db, async () => xml, { languageId: farsi.id, url });
		await expect(add('news.example', rss)).rejects.toThrow('not a web address');
		await expect(add('https://x.example/', '<html></html>')).rejects.toThrow(InvalidFeed);
		await expect(add('https://x.example/', '<rss><channel><title>Empty</title></channel></rss>')).rejects.toThrow('no items');
		await expect(add('https://feeds.bbci.co.uk/persian/rss.xml', rss)).rejects.toThrow('already there');
		await expect(addFeed(db, async () => Promise.reject(new Error('down')), { languageId: farsi.id, url: 'https://y.example/' })).rejects.toThrow(
			"Couldn't read"
		);
	});

	it('are removed', async () => {
		const { db, farsi } = await setup();
		const [first] = await listFeeds(db, farsi.id);
		await removeFeed(db, first.id);
		expect((await listFeeds(db, farsi.id)).map((f) => f.id)).not.toContain(first.id);
	});
});

describe('Suggestions from Feeds', () => {
	const noWikipedia: WikipediaSource = { search: async () => [], random: async () => [], article: async () => undefined };
	const farsiText = (n: number) => Array.from({ length: n }, () => 'کتاب').join(' ') + '.';

	function reader(items: Record<string, { title: string; url: string }[]>): FeedReader & { fetched: string[] } {
		const fetched: string[] = [];
		return {
			fetched,
			items: async (feedUrl) => items[feedUrl] ?? [],
			article: async (url) => (fetched.push(url), url.includes('stub') ? { url, title: 'Stub', text: 'کتاب.' } : { url, title: `Title of ${url}`, text: farsiText(120) })
		};
	}

	it('offers recent items from each Feed, named by Feed, and never one you already have', async () => {
		const { db, farsi } = await setup();
		const many = Array.from({ length: 5 }, (_, i) => ({ title: `b${i}`, url: `https://bbc.example/${i}` }));
		const feeds = reader({
			'https://feeds.bbci.co.uk/persian/rss.xml': many,
			'https://rss.dw.com/rdf/rss-per-all': [
				{ title: 'stub', url: 'https://dw.example/stub' },
				{ title: 'd', url: 'https://dw.example/d' }
			]
		});
		await importFeedItem(db, feeds, farsi, 'https://bbc.example/0');
		expect((await listBooks(db))[0]).toMatchObject({ title: 'Title of https://bbc.example/0', languageName: 'Farsi' });

		const found = await findSuggestions(db, { wikipedia: noWikipedia, feeds }, farsi);
		expect(found.map((f) => [f.url, f.feed]).toSorted()).toEqual([
			['https://bbc.example/1', 'BBC Persian'],
			['https://bbc.example/2', 'BBC Persian'],
			['https://dw.example/d', 'DW Persian']
		]);
		expect(found[0]).toMatchObject({ unknownShare: 1, pageCount: 1 });
		// The Book already had item 0, so it wasn't fetched again; only ITEMS_PER_FEED were tried per Feed.
		expect(feeds.fetched.filter((u) => u.startsWith('https://bbc.example/')).length).toBe(1 + ITEMS_PER_FEED - 1);
	});
});
