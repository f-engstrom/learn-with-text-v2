import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { fits, rankSuggestions } from '../../suggestions';
import type { Database } from '../db/schema';
import { getPage, listBooks } from '../domain/books';
import { listLanguages, type Language } from '../domain/languages';
import { termKey } from '../domain/parsing';
import { getBookmark } from '../domain/reading';
import { findSuggestions, getFitRange, type SuggestionSources } from '../domain/suggestions';
import { findTerms, type TermView } from '../domain/terms';

/**
 * The Reader's MCP server for the Tutor (ADR 0003). These tools only read; every rule lives in
 * the domain code they call, which the web app shares.
 */
export function createReaderServer(db: Kysely<Database>, sources: SuggestionSources): McpServer {
	const server = new McpServer(
		{ name: 'reader', version: '0.1.0' },
		{
			instructions:
				'The Reader holds Books (split into Pages and Sentences), each with a Bookmark, and Terms: what the learner knows about a Word or phrase. ' +
				'A Word with no Term is Unknown. A Term has a Status (learning1–4, known, ignored), ordered Translations each with a Source (you, wiktionary, tutor), an optional Pronunciation and Parent. ' +
				'Start with list_books, then get_sentences to read from the Bookmark.'
		}
	);
	const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

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
		'get_bookmark',
		{
			title: 'Get Bookmark',
			description: "Where the learner is in a Book: the Page and the Sentence on it (both 1-based), with that Sentence's text.",
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
				'Stays within one Page; nextPage says where to continue.',
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
			const all = page.paragraphs.flatMap((p) => p.sentences);
			const sentences = all.slice(from - 1, from - 1 + count).map((s, i) => {
				const words = s.tokens.flatMap((t) => (t.key === undefined ? [] : [wordView(t.text, page.terms[t.key], t.words ?? 1)]));
				return {
					position: from + i,
					isBookmark: position === bookmark.page && from + i === bookmark.sentence,
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

	return server;
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
