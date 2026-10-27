import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { fits, rankSuggestions } from '../../suggestions';
import type { Database } from '../db/schema';
import { createBook, findBookByUrl, getPage, InvalidBook, listBooks } from '../domain/books';
import { listLanguages, type Language } from '../domain/languages';
import { termKey } from '../domain/parsing';
import { getBookmark, InvalidBookmark, latestBookmark, markPageRead, setBookmark } from '../domain/reading';
import { findSuggestions, getFitRange, importArticle, type SuggestionSources } from '../domain/suggestions';
import { findTerms, InvalidTerm, type TermView } from '../domain/terms';
import { adjustLearning, linkParent, saveGloss } from '../domain/tutoring';
import { fetchArticle, InvalidAddress, type WebArticle } from '../domain/webpages';

/**
 * The Reader's MCP server for the Tutor (ADR 0003). Every rule (what a Gloss may be saved for, how
 * far a Tutor adjustment goes) lives in the domain code the tools call, which the web app shares.
 */
export function createReaderServer(
	db: Kysely<Database>,
	sources: SuggestionSources,
	readArticle: (url: string) => Promise<WebArticle> = fetchArticle
): McpServer {
	const server = new McpServer(
		{ name: 'reader', version: '0.1.0' },
		{
			instructions:
				'The Reader holds Books (split into Pages and Sentences), each with a Bookmark, and Terms: what the learner knows about a Word or phrase. ' +
				'A Word with no Term is Unknown. A Term has a Status (learning1–4, known, ignored), ordered Translations each with a Source (you, wiktionary, tutor), an optional Pronunciation and Parent. ' +
				'Start with list_books, then get_sentences to read from the Bookmark; where_am_i says where the learner is right now when they read on their own. ' +
				'While tutoring: save_gloss for a meaning you give (only Unknown Words and Learning 1–2 Terms), set_parent to link an inflected form to its dictionary form, adjust_learning after the learner answers about a Term, ' +
				'set_bookmark as you move through the text, and mark_page_read at the end of a Page. Only the learner sets Known or Ignored.'
		}
	);
	const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
	const writes = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

	server.registerTool(
		'list_languages',
		{ title: 'List Languages', description: 'The Languages being studied, with their codes.', annotations: readOnly },
		async () => json((await listLanguages(db)).map(({ id, name, code, rightToLeft }) => ({ id, name, code, rightToLeft })))
	);

	server.registerTool(
		'list_books',
		{
			title: 'List Books',
			description: "Every Book, newest first, with its Language, Pages, Bookmark and Unknown share (the share of its distinct Words that are Unknown).",
			annotations: readOnly
		},
		async () => json(await listBooks(db))
	);

	server.registerTool(
		'where_am_i',
		{
			title: 'Where am I',
			description:
				'Where the learner is right now: the Book whose Bookmark moved most recently (in the reading screen or by you), ' +
				'its Sentence with the paragraph so far, and the Word or phrase they last selected there, with its Status and Translations. ' +
				'Use it when the learner says "I\'m here", "help me with this" or similar while reading on their own.',
			annotations: readOnly
		},
		async () => {
			const latest = await latestBookmark(db);
			if (!latest) return failure('No Bookmark has moved yet: the learner hasn’t opened a Book. Use list_books.');
			const page = await getPage(db, latest.bookId, latest.bookmark.page);
			if (!page) return failure(`Book ${latest.bookId} has no Page ${latest.bookmark.page}.`);
			const sentences = page.paragraphs.flatMap((p, paragraph) => p.sentences.map((s) => ({ ...s, paragraph })));
			const current = sentences[latest.bookmark.sentence - 1];
			const text = (s: { tokens: { text: string }[] }) => s.tokens.map((t) => t.text).join('').trim();
			const wanted = latest.bookmark.word?.toLocaleLowerCase(page.language.code);
			const token = current?.tokens.find((t) => t.key !== undefined && t.text.toLocaleLowerCase(page.language.code) === wanted);
			return json({
				book: { id: latest.bookId, title: latest.title, language: page.language.name, pageCount: page.book.pageCount },
				bookmark: latest.bookmark,
				movedAt: latest.at,
				sentence: current && text(current),
				paragraphSoFar: current && sentences.filter((s, i) => s.paragraph === current.paragraph && i < latest.bookmark.sentence).map(text).join(' '),
				word: token?.key !== undefined ? wordView(token.text, page.terms[token.key], token.words ?? 1) : undefined
			});
		}
	);

	server.registerTool(
		'get_bookmark',
		{
			title: 'Get Bookmark',
			description:
				"Where the learner is in a Book: the Page and the Sentence on it (both 1-based), with that Sentence's text, and the Word they last selected there if any.",
			inputSchema: { book_id: z.number().int().describe('The Book, from list_books.') },
			annotations: readOnly
		},
		async ({ book_id }) => {
			const bookmark = await getBookmark(db, book_id);
			if (!bookmark) return failure(`There is no Book ${book_id}.`);
			const page = await getPage(db, book_id, bookmark.page);
			const sentence = page?.paragraphs.flatMap((p) => p.sentences)[bookmark.sentence - 1];
			return json({
				book: { id: book_id, title: page?.book.title, language: page?.language.name, pageCount: page?.book.pageCount },
				bookmark,
				sentence: sentence?.tokens.map((t) => t.text).join('').trim()
			});
		}
	);

	server.registerTool(
		'get_sentences',
		{
			title: 'Get Sentences',
			description:
				"Sentences of a Book's Page, from the Bookmark unless a Page and Sentence are given, with each Word's Status and Translations. " +
				'Status "unknown" means the Word has no Term. A matched Multi-word Term (e.g. "в течение") is one entry. ' +
				'Each Sentence carries its paragraph number on the Page; the Word the learner selected in the Bookmark Sentence is marked selected. Stays within one Page; nextPage says where to continue.',
			inputSchema: {
				book_id: z.number().int().describe('The Book, from list_books.'),
				page: z.number().int().min(1).optional().describe("1-based Page; the Bookmark's by default."),
				sentence: z.number().int().min(1).optional().describe("1-based Sentence on that Page to start at; the Bookmark's by default."),
				count: z.number().int().min(1).max(30).default(5).describe('How many Sentences to return.')
			},
			annotations: readOnly
		},
		async ({ book_id, page: pageNumber, sentence: start, count }) => {
			const bookmark = await getBookmark(db, book_id);
			if (!bookmark) return failure(`There is no Book ${book_id}.`);
			const position = pageNumber ?? bookmark.page;
			const page = await getPage(db, book_id, position);
			if (!page) return failure(`Book ${book_id} has no Page ${position}.`);
			const from = start ?? (position === bookmark.page ? bookmark.sentence : 1);
			const all = page.paragraphs.flatMap((p, paragraph) => p.sentences.map((s) => ({ ...s, paragraph: paragraph + 1 })));
			const sentences = all.slice(from - 1, from - 1 + count).map((s, i) => {
				const isBookmark = position === bookmark.page && from + i === bookmark.sentence;
				const selectedWord = isBookmark ? bookmark.word?.toLocaleLowerCase(page.language.code) : undefined;
				const words = s.tokens.flatMap((t) =>
					t.key === undefined
						? []
						: [
								{
									...wordView(t.text, page.terms[t.key], t.words ?? 1),
									...(selectedWord !== undefined && t.text.toLocaleLowerCase(page.language.code) === selectedWord ? { selected: true } : {})
								}
							]
				);
				return {
					position: from + i,
					paragraph: s.paragraph,
					isBookmark,
					text: s.tokens.map((t) => t.text).join('').trim(),
					words
				};
			});
			const unknown = [...new Set(sentences.flatMap((s) => s.words.filter((w) => w.status === 'unknown').map((w) => w.text.toLocaleLowerCase(page.language.code))))];
			const last = from - 1 + sentences.length;
			return json({
				book: { id: book_id, title: page.book.title, language: page.language.name, pageCount: page.book.pageCount },
				page: { position, read: page.read, sentenceCount: all.length },
				bookmark,
				sentences,
				unknown,
				nextPage: last >= all.length && position < page.book.pageCount ? position + 1 : undefined
			});
		}
	);

	server.registerTool(
		'look_up_term',
		{
			title: 'Look up a Term',
			description: 'What the learner has recorded about a Word or phrase in a Language: Status, Translations (with Source), Pronunciation and Parent. Unknown if there is no Term.',
			inputSchema: {
				language: z.string().describe('Language name or code, e.g. "Russian" or "ru".'),
				text: z.string().min(1).describe('The Word or phrase, in any case or form of spelling.')
			},
			annotations: readOnly
		},
		async ({ language: name, text }) => {
			const language = await findLanguage(db, name);
			if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
			const key = termKey(text, language);
			const term = (await findTerms(db, language.id, [key]))[key];
			return json(term ? { text: term.text, ...termView(term) } : { text, status: 'unknown' });
		}
	);

	server.registerTool(
		'get_suggestions',
		{
			title: 'Get Suggestions',
			description:
				"Things to read in a Language, from Wikipedia (for the learner's Topics) and the Language's news Feeds, best first: inside the learner's Fit range of Unknown share, then on a Topic, then one to three Pages long. Reads the web, so it takes a few seconds.",
			inputSchema: { language: z.string().describe('Language name or code.') },
			annotations: { readOnlyHint: true, openWorldHint: true }
		},
		async ({ language: name }) => {
			const language = await findLanguage(db, name);
			if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
			const range = await getFitRange(db, language.id);
			const found = await findSuggestions(db, sources, language);
			return json({
				fitRange: range,
				suggestions: rankSuggestions(found, range).map(({ text, ...s }) => ({ ...s, fits: fits(s, range) }))
			});
		}
	);

	server.registerTool(
		'save_gloss',
		{
			title: 'Save a Gloss',
			description:
				'Saves a short meaning you offered for a Word or phrase as a Translation with Source Tutor. ' +
				'Only for Unknown Words (which then get a Term at Learning 1) and Learning 1–2 Terms; refused otherwise.',
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				text: z.string().min(1).describe('The Word or phrase as it appears in the text.'),
				gloss: z.string().min(1).describe('The short meaning, e.g. "during".')
			},
			annotations: writes
		},
		async ({ language: name, text, gloss }) =>
			guard(async () => {
				const language = await findLanguage(db, name);
				if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
				return json(await saveGloss(db, { languageId: language.id, text, gloss }));
			})
	);

	server.registerTool(
		'adjust_learning',
		{
			title: 'Adjust a Learning level',
			description:
				'A Tutor adjustment: one Learning step up after the learner answers correctly about a Term, one down after a miss. ' +
				'Only for Learning 1–4 Terms, and never past Learning 1 or 4; Known and Ignored are the learner’s to set.',
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				text: z.string().min(1).describe('The Word or phrase.'),
				direction: z.enum(['up', 'down'])
			},
			annotations: writes
		},
		async ({ language: name, text, direction }) =>
			guard(async () => {
				const language = await findLanguage(db, name);
				if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
				return json(await adjustLearning(db, { languageId: language.id, text, direction }));
			})
	);

	server.registerTool(
		'set_parent',
		{
			title: 'Set a Parent',
			description:
				'Links a Term to its Parent, usually its dictionary form (набережной → набережная, читала → читать). ' +
				'A missing Parent gets a Term at the same Status. The Term keeps its Status and Translations. ' +
				'Refused for an Unknown Word (save a Gloss first) and for a Term that follows a different Parent.',
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				text: z.string().min(1).describe('The Term, as it appears in the text.'),
				parent: z.string().min(1).describe('Its dictionary form.')
			},
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ language: name, text, parent }) =>
			guard(async () => {
				const language = await findLanguage(db, name);
				if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
				return json(await linkParent(db, { languageId: language.id, text, parent }));
			})
	);

	server.registerTool(
		'set_bookmark',
		{
			title: 'Move the Bookmark',
			description:
				'Moves a Book’s Bookmark to a Page and Sentence (both 1-based), optionally on a Word in that Sentence. The reading screen opens there too.',
			inputSchema: {
				book_id: z.number().int(),
				page: z.number().int().min(1),
				sentence: z.number().int().min(1).default(1),
				word: z.string().optional().describe('A Word or phrase in that Sentence, as written.')
			},
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ book_id, page, sentence, word }) => guard(async () => json({ bookmark: await setBookmark(db, book_id, { page, sentence, word }) }))
	);

	server.registerTool(
		'mark_page_read',
		{
			title: 'Mark a Page Read',
			description:
				'Marks a Page Read and moves the Bookmark to the start of the next Page. ' +
				'rest_known also makes every remaining Unknown Word on the Page Known; use it only when the learner says so.',
			inputSchema: {
				book_id: z.number().int(),
				page: z.number().int().min(1),
				rest_known: z.boolean().default(false)
			},
			annotations: writes
		},
		async ({ book_id, page, rest_known }) =>
			guard(async () => {
				const next = await markPageRead(db, book_id, page, { restKnown: rest_known });
				return json({ read: page, bookmark: await getBookmark(db, book_id), nextPage: next });
			})
	);

	server.registerTool(
		'import_book',
		{
			title: 'Import a Book',
			description:
				'Creates a Book from text you give (with a title) or from a web address, whose article text is extracted. ' +
				'A web address the learner already has as a Book returns that Book instead.',
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				title: z.string().optional().describe('Needed for text; for a web address, the headline is used if left out.'),
				text: z.string().optional().describe('The text. A line containing only --- starts a new Page.'),
				url: z.string().optional().describe('A web page to read the article from.')
			},
			annotations: { ...writes, openWorldHint: true }
		},
		async ({ language: name, title, text, url }) =>
			guard(async () => {
				const language = await findLanguage(db, name);
				if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
				if ((text === undefined) === (url === undefined)) return failure('Give either text or url.');
				// A Wikipedia article comes in through its API, cut like a Suggestion, without the page's notices.
				const wikipedia = url === undefined ? undefined : wikipediaTitle(url, language.code);
				if (wikipedia !== undefined) {
					const bookId = await importArticle(db, sources.wikipedia, language, wikipedia);
					if (bookId === undefined) return failure(`Wikipedia has no article "${wikipedia}".`);
					return json({ bookId, title: wikipedia });
				}
				if (url !== undefined) {
					const article = await readArticle(url);
					const existing = await findBookByUrl(db, article.url);
					if (existing !== undefined) return json({ bookId: existing, alreadyHad: true });
					const bookId = await createBook(db, { languageId: language.id, title: title?.trim() || article.title, text: article.text, url: article.url });
					return json({ bookId, title: title?.trim() || article.title });
				}
				return json({ bookId: await createBook(db, { languageId: language.id, title: title ?? '', text: text! }) });
			})
	);

	return server;
}

/** The article title of an address on the Language's Wikipedia, e.g. https://ru.wikipedia.org/wiki/Футбол. */
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

/** Turns a broken rule into an error result the Tutor can read and act on. */
async function guard(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof InvalidTerm || e instanceof InvalidBookmark || e instanceof InvalidBook || e instanceof InvalidAddress) {
			return failure(e.message);
		}
		throw e;
	}
}

function wordView(text: string, term: TermView | undefined, words: number) {
	return { text, ...(words > 1 ? { multiWord: true } : {}), ...(term ? termView(term) : { status: 'unknown' as const }) };
}

function termView(term: TermView) {
	return {
		status: term.status,
		translations: term.translations.map((t) => (t.source === 'you' ? t.text : `${t.text} (${t.source})`)),
		...(term.pronunciation ? { pronunciation: term.pronunciation } : {}),
		...(term.parent ? { parent: term.parent.text, followsParent: term.followsParent } : {})
	};
}

async function findLanguage(db: Kysely<Database>, name: string): Promise<Language | undefined> {
	const wanted = name.trim().toLowerCase();
	return (await listLanguages(db)).find((l) => l.name.toLowerCase() === wanted || l.code.toLowerCase() === wanted);
}

function json(value: unknown): CallToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function failure(message: string): CallToolResult {
	return { isError: true, content: [{ type: 'text', text: message }] };
}
