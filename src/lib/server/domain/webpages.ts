import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

/** An article as the New Book screen shows it, to edit before saving. */
export interface WebArticle {
	url: string;
	title: string;
	text: string;
}

export class InvalidAddress extends Error {}

export const MAX_PAGE_BYTES = 5 * 1024 * 1024;
/** Less text than this is a menu or a notice, not an article. */
const MIN_ARTICLE_CHARS = 100;
const TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; Reader/0.1; personal language-learning app)';

/** Class or id names of page parts that are never the article: ads, sharing, related links, notices. */
const CLUTTER =
	/^(ad|ads|advert|advertisement|adv|banner|promo|sponsor|sponsored|share|sharing|social|newsletter|subscribe|subscription|related|recommended|cookie|cookies|consent|paywall|comments?)([-_].*)?$/i;

/** A short block that is nothing but a link, like "Advertisement" or "Read more". */
function isOnlyALink(el: Element): boolean {
	const text = (el.textContent ?? '').trim();
	const linked = [...el.querySelectorAll('a')].map((a) => a.textContent ?? '').join('').trim();
	return text !== '' && text.length < 80 && linked === text;
}

/** Elements whose text is one paragraph of the article. */
const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, dd, dt';

/**
 * The main text of a web page, without menus, ads and footers, as one paragraph per line.
 * Undefined when the page has no article to speak of.
 */
export function extractArticle(html: string, url: string): Omit<WebArticle, 'url'> | undefined {
	const { document } = parseHTML(html);
	// Readability resolves links against the page's address.
	if (!document.querySelector('base')) {
		const base = document.createElement('base');
		base.setAttribute('href', url);
		document.head?.append(base);
	}
	const fallbackTitle = document.querySelector('title')?.textContent?.trim() ?? '';
	// Page titles often add the site's name; a single <h1> that the title contains is the headline alone.
	const headings = [...document.querySelectorAll('h1')].map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim());
	const headline = headings.length === 1 && headings[0] !== '' && fallbackTitle.includes(headings[0]) ? headings[0] : undefined;
	for (const el of [...document.querySelectorAll('[class], [id]')]) {
		const names = `${el.getAttribute('class') ?? ''} ${el.getAttribute('id') ?? ''}`.split(/\s+/);
		if (names.some((n) => CLUTTER.test(n))) el.remove();
	}
	const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
	if (!article?.content) return undefined;

	const { document: content } = parseHTML(`<!doctype html><html><body>${article.content}</body></html>`);
	const blocks = [...content.querySelectorAll(BLOCKS)].filter((el) => !el.querySelector(BLOCKS) && !isOnlyALink(el));
	const paragraphs = (blocks.length > 0 ? blocks.map((el) => el.textContent ?? '') : (content.body.textContent ?? '').split('\n'))
		.map((p) => p.replace(/\s+/g, ' ').trim())
		// Lines without letters (dates, a row of dashes, which would start a new Page) aren't reading.
		.filter((p) => /\p{L}/u.test(p));
	const title = headline ?? ((article.title ?? '').replace(/\s+/g, ' ').trim() || fallbackTitle);
	// The headline is the Book's title, not its first line.
	if (paragraphs[0] === title) paragraphs.shift();
	if (paragraphs.join('').length < MIN_ARTICLE_CHARS) return undefined;

	return { title, text: paragraphs.join('\n') };
}

/**
 * Decodes a page in the character set its headers name, or failing that its `<meta charset>`
 * (many Russian sites still use windows-1251), or UTF-8.
 */
export function decodePage(bytes: Uint8Array, contentType: string | null): string {
	const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
	const charset =
		contentType?.match(/charset=["']?([\w-]+)/i)?.[1] ??
		head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
		'utf-8';
	try {
		return new TextDecoder(charset.toLowerCase()).decode(bytes);
	} catch {
		return new TextDecoder('utf-8').decode(bytes);
	}
}

/** Fetches a web page and extracts its article. */
export async function fetchArticle(address: string, fetchFn: typeof fetch = fetch): Promise<WebArticle> {
	let url: URL;
	try {
		url = new URL(address.trim());
	} catch {
		throw new InvalidAddress('That is not a web address. It should start with https://');
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new InvalidAddress('Only http and https addresses can be read.');

	let response: Response;
	try {
		response = await fetchFn(url, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
			redirect: 'follow',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		throw new InvalidAddress("Couldn't reach that address.");
	}
	if (!response.ok) throw new InvalidAddress(`The site answered ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`);
	const contentType = response.headers.get('content-type');
	if (contentType && !/html/i.test(contentType)) throw new InvalidAddress("That address isn't a web page.");

	const bytes = await readLimited(response, MAX_PAGE_BYTES);
	const finalUrl = response.url || url.href;
	const article = extractArticle(decodePage(bytes, contentType), finalUrl);
	if (!article) throw new InvalidAddress("Couldn't find an article on that page.");
	return { url: finalUrl, ...article };
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
	if (!response.body) return new Uint8Array(await response.arrayBuffer());
	const chunks: Uint8Array[] = [];
	let size = 0;
	for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
		size += chunk.length;
		if (size > limit) throw new InvalidAddress('That page is larger than 5 MB.');
		chunks.push(chunk);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}
