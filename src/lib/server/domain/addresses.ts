import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { BookExists, createBook, findBookByUrl } from './books';
import { findClassic } from './classics';
import type { Language } from './languages';
import { readClassic, readWikipedia, type SuggestionSources } from './suggestions';
import { fetchArticle, InvalidAddress, type WebArticle } from './webpages';

// A Book from a web address, read the same way whether you paste the address or the Tutor imports it.

/** Where texts at web addresses are read from: Wikipedia and Wikisource by their APIs, any other page as an article. */
export type AddressSources = Pick<SuggestionSources, 'wikipedia' | 'wikisource'> & {
	readArticle?: (url: string) => Promise<WebArticle>;
};

/** The article title in a link to the Language's Wikipedia, e.g. https://ru.wikipedia.org/wiki/Кот. */
export function wikipediaTitle(url: string, code: string): string | undefined {
	try {
		const parsed = new URL(url);
		if (!new RegExp(`^${code}(\\.m)?\\.wikipedia\\.org$`).test(parsed.hostname)) return undefined;
		const match = parsed.pathname.match(/^\/wiki\/(.+)$/);
		return match ? decodeURIComponent(match[1]).replaceAll('_', ' ') : undefined;
	} catch {
		return undefined;
	}
}

/**
 * The text at a web address, read the way its source reads best: a Wikipedia article through its API,
 * cut like a Suggestion; a Classic whole, without Wikisource's notes; any other page as an article.
 */
export async function readAddress(sources: AddressSources, language: Language, url: string): Promise<WebArticle> {
	const title = wikipediaTitle(url, language.code);
	if (title !== undefined) {
		const article = await readWikipedia(sources.wikipedia, language, title);
		if (!article) throw new InvalidAddress(`Wikipedia has no article "${title}".`);
		return article;
	}
	if (sources.wikisource && findClassic(language.code, url)) {
		const classic = await readClassic(sources.wikisource, language, url);
		if (!classic) throw new InvalidAddress("Wikisource doesn't have that text any more.");
		return classic;
	}
	return (sources.readArticle ?? fetchArticle)(url);
}

/** Imports the text at a web address as a Book, or gives back the Book you already have from it. */
export async function importFromAddress(
	db: Kysely<Database>,
	sources: AddressSources,
	language: Language,
	url: string,
	title?: string
): Promise<{ bookId: number; title: string } | { bookId: number; alreadyHad: true }> {
	const had = await findBookByUrl(db, url);
	if (had !== undefined) return { bookId: had, alreadyHad: true };
	const article = await readAddress(sources, language, url);
	const named = title?.trim() || article.title;
	try {
		return { bookId: await createBook(db, { languageId: language.id, title: named, text: article.text, url: article.url }), title: named };
	} catch (e) {
		// The address it settled on (after redirects) may be one you already have.
		if (e instanceof BookExists) return { bookId: e.bookId, alreadyHad: true };
		throw e;
	}
}
