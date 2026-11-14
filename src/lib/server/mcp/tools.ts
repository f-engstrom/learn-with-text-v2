import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { fits, rankSuggestions } from '../../suggestions';
import type { Database } from '../db/schema';
import { editPagesAsTutor, listPages } from '../domain/book-editing';
import { createBook, getPage, listBooks } from '../domain/books';
import { importFromAddress } from '../domain/addresses';
import { listLanguages, type Language } from '../domain/languages';
import { termKey } from '../domain/parsing';
import {
	clearHighlight,
	getBookmark,
	getHighlight,
	highlightNoteLength,
	latestBookmark,
	markPageRead,
	setBookmark,
	setHighlight
} from '../domain/reading';
import { findSuggestions, getFitRange, type SuggestionSources } from '../domain/suggestions';
import { findTerms, listTerms, type TermView } from '../domain/terms';
import { assessTerm, linkParent, saveGloss, setOrigin, setTransfer } from '../domain/tutoring';
import { getProgress } from '../domain/progress';
import { askLearner, awaitAnswer, feedbackLength, withdrawQuestion } from '../domain/from-tutor';
import { listYourLanguages, removeYourLanguage, setYourLanguage, YOUR_LANGUAGE_LEVELS } from '../domain/your-languages';
import { byPriority } from '../../practice';
import { bookmarkedWord } from '../../reading/bookmark';
import { fetchArticle, type WebArticle } from '../domain/webpages';
import { Refused } from '../domain/refused';

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
				'A Word with no Term is Unknown. A Term has a Status (learning1–4, known, ignored), ordered Translations each with a Source (you, wiktionary, tutor, azure), an optional Pronunciation and Parent. ' +
				'Start with list_books, then get_sentences to read from the Bookmark; where_am_i says where the learner is right now when they read on their own. ' +
				'While tutoring: save_gloss for a meaning you give (only Unknown Words and Learning 1–2 Terms), set_parent to link an inflected form to its dictionary form, ' +
				'assess_term after the learner answers about a Term (it moves your own assessment, never their Status, and counts as a Review), set_transfer when you judge how hard a Term is to carry over from their languages (list_your_languages), set_origin when you tell them where a word comes from or what it is related to (read a Term\'s origin before inventing a bridge), ' +
				'set_bookmark as you move through the text, set_highlight to point the learner at Sentences in their reading screen, ask_learner to put your question there and wait for their answer, and mark_page_read at the end of a Page. ' +
				'get_due_terms lists Terms due for practice, by priority, for warm-ups and quizzes. get_progress shows Words read, Milestones and Known Terms. ' +
				'To clean up a messy import (menus, footers, a sentence cut across Pages), read it with get_pages and fix it with edit_pages; Read Pages are the learner\'s. Only the learner sets a Status.'
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
				'its Sentence with the paragraph so far, the Word or phrase they last selected there with its Status and Translations, and your Highlight in that Book if any. ' +
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
			const token = current && bookmarkedWord(current.tokens, latest.bookmark.word, page.language.code);
			return json({
				book: { id: latest.bookId, title: latest.title, language: page.language.name, pageCount: page.book.pageCount },
				bookmark: latest.bookmark,
				movedAt: latest.at,
				sentence: current && text(current),
				paragraphSoFar: current && sentences.filter((s, i) => s.paragraph === current.paragraph && i < latest.bookmark.sentence).map(text).join(' '),
				word: token?.key !== undefined ? wordView(token.text, page.terms[token.key], token.words ?? 1) : undefined,
				highlight: await getHighlight(db, latest.bookId)
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
				'Each Sentence carries its paragraph number on the Page; the Word the learner selected in the Bookmark Sentence is marked selected, and Sentences in your Highlight are marked highlighted. Stays within one Page; nextPage says where to continue.',
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
			const highlight = await getHighlight(db, book_id);
			const inHighlight = (n: number) => highlight?.page === position && n >= highlight.first && n <= highlight.last;
			const all = page.paragraphs.flatMap((p, paragraph) => p.sentences.map((s) => ({ ...s, paragraph: paragraph + 1 })));
			const sentences = all.slice(from - 1, from - 1 + count).map((s, i) => {
				const isBookmark = position === bookmark.page && from + i === bookmark.sentence;
				const selectedWord = isBookmark ? bookmarkedWord(s.tokens, bookmark.word, page.language.code) : undefined;
				const words = s.tokens.flatMap((t) =>
					t.key === undefined
						? []
						: [
								{
									...wordView(t.text, page.terms[t.key], t.words ?? 1),
									...(t === selectedWord ? { selected: true } : {})
								}
							]
				);
				return {
					position: from + i,
					paragraph: s.paragraph,
					isBookmark,
					...(inHighlight(from + i) ? { highlighted: true } : {}),
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
				...(highlight ? { highlight } : {}),
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
				"Things to read in a Language, from Wikipedia (for the learner's Topics), the Language's news Feeds and short public-domain Classics from Wikisource (with an author), best first: inside the learner's Fit range of Unknown share, then on a Topic, then one to three Pages long. Reads the web, so it takes a few seconds.",
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
		'assess_term',
		{
			title: 'Assess a Term from an answer',
			description:
				"A Tutor adjustment after the learner answers about a Term: got moves your assessment of it one step up (Learning 1–4, then Known), missed one down, hard leaves it. " +
				"It starts from the learner's Status and never changes it; when your assessment and their Status differ, you may suggest they change it. " +
				'For a Learning 1–4 Term the answer also counts as a Review, which reschedules its practice.',
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				text: z.string().min(1).describe('The Word or phrase.'),
				answer: z.enum(['missed', 'hard', 'got'])
			},
			annotations: writes
		},
		async ({ language: name, text, answer }) =>
			guard(async () => {
				const language = await findLanguage(db, name);
				if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
				return json(await assessTerm(db, { languageId: language.id, text, answer }));
			})
	);

	server.registerTool(
		'set_transfer',
		{
			title: 'Set Transfer',
			description:
				"How hard a Term is to carry over from the learner's languages (list_your_languages): form (is there a look-alike word?) and concept (does the meaning map one-to-one?), " +
				'each easy, medium or hard, with a short reason. Harder Terms come earlier in practice.',
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				text: z.string().min(1).describe('The Word or phrase; it must have a Term.'),
				form: z.enum(['easy', 'medium', 'hard']),
				concept: z.enum(['easy', 'medium', 'hard']),
				reason: z.string().max(200).optional().describe('e.g. "no look-alike; Swedish längtan covers part of it".')
			},
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ language: name, text, form, concept, reason }) =>
			guard(async () => {
				const language = await findLanguage(db, name);
				if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
				return json({ transfer: await setTransfer(db, { languageId: language.id, text, form, concept, reason }) });
			})
	);

	server.registerTool(
		'set_origin',
		{
			title: 'Set Origin',
			description:
				"Where a Term's word comes from or what it is related to in other languages: a fact about the word, unlike Transfer. " +
				'Links in order, nearest source first (a chain: loanword from Turkish çorap, which is from Persian jurāb), and cognates, with a short note for the story. ' +
				"It replaces Wiktionary's or your own Origin; one the learner wrote is theirs. A Term that follows its Parent shows the Parent's, so set it on the Parent.",
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				text: z.string().min(1).describe('The Word or phrase; it must have a Term.'),
				links: z
					.array(
						z.object({
							kind: z.enum(['loanword', 'inherited', 'derived', 'calque', 'cognate']),
							language: z.string().min(1).describe('The language named in words, e.g. "English", "Ottoman Turkish", "Proto-Slavic".'),
							word: z.string().optional().describe('The word in that language.')
						})
					)
					.max(8),
				note: z.string().max(300).optional().describe('e.g. "from Vauxhall, a London pleasure garden; the name reached Russia via Pavlovsk station".')
			},
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ language: name, text, links, note }) =>
			guard(async () => {
				const language = await findLanguage(db, name);
				if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
				return json({ origin: await setOrigin(db, { languageId: language.id, text, links, note }) });
			})
	);

	server.registerTool(
		'get_due_terms',
		{
			title: 'Get Due Terms',
			description:
				'Terms in a Language that are Due for practice, by Practice priority (frequent first, then harder to carry over, then most overdue), ' +
				'with Translations, Frequency, Transfer, your assessment and Recall strength. Use them for warm-ups and quizzes.',
			inputSchema: {
				language: z.string().describe('Language name or code.'),
				limit: z.number().int().min(1).max(50).default(10)
			},
			annotations: readOnly
		},
		async ({ language: name, limit }) => {
			const language = await findLanguage(db, name);
			if (!language) return failure(`Unknown Language "${name}". Use list_languages.`);
			const { terms, total } = await listTerms(db, { languageId: language.id, due: 'due', limit: 1000 });
			const ranked = terms
				.map((term, index) => ({ ...term, practice: term.practice!, index }))
				.sort(byPriority)
				.slice(0, limit);
			return json({ due: total, terms: ranked.map((term) => ({ text: term.text, ...termView(term) })) });
		}
	);

	server.registerTool(
		'list_your_languages',
		{
			title: 'List Your languages',
			description: "The languages the learner already knows (native, fluent or some): Transfer and your bridges are measured against these.",
			annotations: readOnly
		},
		async () => json(await listYourLanguages(db))
	);

	server.registerTool(
		'get_progress',
		{
			title: 'Get progress',
			description:
				"Per Language: Words read (Words on Pages marked Read) with the last Milestone passed and the next, Reading days this week, Words read per week, Known Terms now and over time, and the Due forecast for the next 14 days. Mention a new Milestone gladly; never point out days without reading.",
			annotations: readOnly
		},
		async () => json(await getProgress(db))
	);

	server.registerTool(
		'set_your_language',
		{
			title: 'Set one of Your languages',
			description:
				'Adds a language the learner knows, or changes how well. Add one when the learner mentions it ("I speak Swedish", "my German is rusty"), and say so in a line.',
			inputSchema: {
				name: z.string().min(1).describe('In English, e.g. "Swedish".'),
				level: z.enum(YOUR_LANGUAGE_LEVELS as [string, ...string[]])
			},
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ name, level }) => guard(async () => json(await setYourLanguage(db, { name, level })))
	);

	server.registerTool(
		'remove_your_language',
		{
			title: 'Remove one of Your languages',
			description: 'Removes a language the learner listed by mistake.',
			inputSchema: { name: z.string().min(1) },
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ name }) => {
			await removeYourLanguage(db, name);
			return json(await listYourLanguages(db));
		}
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
		'set_highlight',
		{
			title: 'Highlight Sentences',
			description:
				'Points the learner at a run of Sentences on one Page (1-based, inclusive), or at a passage within them such as the clause you are working on (text), ' +
				'with an optional short note, e.g. "Who is speaking here?". ' +
				'Their open reading screen shows it within a few seconds. It replaces the Book’s previous Highlight, never moves the Bookmark, ' +
				'and lasts until you set another, clear_highlight, or the Page is marked Read.',
			inputSchema: {
				book_id: z.number().int(),
				page: z.number().int().min(1),
				first: z.number().int().min(1).describe('First Sentence on the Page.'),
				last: z.number().int().min(1).optional().describe('Last Sentence; the first by default.'),
				text: z
					.string()
					.max(500)
					.optional()
					.describe('A passage within those Sentences, exactly as written there (case and spacing may differ), e.g. one clause of a long Sentence. Omit to highlight the Sentences whole.'),
				note: z.string().max(highlightNoteLength).optional().describe('A sentence or two shown beside the Highlight.')
			},
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ book_id, page, first, last, text, note }) =>
			guard(async () => json({ highlight: await setHighlight(db, book_id, { page, first, last: last ?? first, text, note }) }))
	);

	server.registerTool(
		'clear_highlight',
		{
			title: 'Clear the Highlight',
			description: 'Removes the Book’s Highlight, e.g. when the learner has read what you pointed them to.',
			inputSchema: { book_id: z.number().int() },
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ book_id }) => {
			await clearHighlight(db, book_id);
			return json({ highlight: null });
		}
	);

	const waitSeconds = z
		.number()
		.int()
		.min(0)
		.max(600)
		.optional()
		.describe('How long to wait for the answer, in seconds (default 120). On "waiting", call wait_for_answer.');
	const heard = (book_id: number, wait_seconds = 120) => awaitAnswer(db, book_id, { timeoutMs: wait_seconds * 1000 }).then(json);

	server.registerTool(
		'ask_learner',
		{
			title: 'Ask in the reading screen',
			description:
				'Puts your question in the learner’s reading screen, beside the Highlight, and waits for their answer. ' +
				'Give feedback on their last answer with it, and the chunk’s Glosses as a list. The Highlight’s passage shows in the card, so a prompt need not repeat it ("Translate the highlighted clause."). One to four questions: one without options is typed (a translation, an open question), ' +
				'one with two to four options is picked (they may type their own instead). They answer one question at a time and send at the end, which is their go-ahead, so don’t add a "ready to move on?" question. It replaces the Book’s previous question. ' +
				'Returns status "answered" with answers (one per question, in order) or ask (their own question for you, instead of answering), ' +
				'"dismissed" (they put the Tutor aside: stop and wait for them in chat), or "waiting" (still thinking: call wait_for_answer).',
			inputSchema: {
				book_id: z.number().int(),
				feedback: z
					.string()
					.max(feedbackLength)
					.optional()
					.describe('On their last answer: ✓ / almost / not quite, and the correct reading, in a few lines. Line breaks are kept.'),
				glosses: z
					.array(z.object({ text: z.string().min(1).max(120), gloss: z.string().min(1).max(120) }))
					.max(12)
					.optional()
					.describe('The Glosses for this chunk, shown as a list; save each with save_gloss too.'),
				questions: z
					.array(z.object({ prompt: z.string().min(1).max(300), options: z.array(z.string().min(1).max(120)).optional() }))
					.min(1)
					.max(4),
				wait_seconds: waitSeconds
			},
			annotations: writes
		},
		async ({ book_id, feedback, glosses, questions, wait_seconds }) =>
			guard(async () => {
				await askLearner(db, book_id, { feedback, glosses, questions });
				return heard(book_id, wait_seconds);
			})
	);

	server.registerTool(
		'wait_for_answer',
		{
			title: 'Wait for the answer',
			description: 'Waits again for the learner to answer the Book’s question in the reading screen, after ask_learner said "waiting". Same statuses, or "none" with no question.',
			inputSchema: { book_id: z.number().int(), wait_seconds: waitSeconds },
			annotations: readOnly
		},
		async ({ book_id, wait_seconds }) => heard(book_id, wait_seconds)
	);

	server.registerTool(
		'withdraw_question',
		{
			title: 'Withdraw the question',
			description: 'Takes your question out of the reading screen, e.g. when you stop or carry on in chat.',
			inputSchema: { book_id: z.number().int() },
			annotations: { ...writes, idempotentHint: true }
		},
		async ({ book_id }) => {
			await withdrawQuestion(db, book_id);
			return json({ status: 'none' });
		}
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
				// Wikipedia articles and Classics come in through their APIs, without the pages' notices.
				if (url !== undefined) return json(await importFromAddress(db, { ...sources, readArticle }, language, url, title));
				return json({ bookId: await createBook(db, { languageId: language.id, title: title ?? '', text: text! }) });
			})
	);

	server.registerTool(
		'get_pages',
		{
			title: 'Get Pages',
			description:
				"A Book's Pages as stored, for cleaning it up: each Page's id, position, whether it is Read, its Words and its raw text with line breaks. " +
				'Give from and to (1-based positions) to read a long Book a stretch at a time.',
			inputSchema: {
				book_id: z.number().int(),
				from: z.number().int().min(1).default(1),
				to: z.number().int().min(1).optional()
			},
			annotations: readOnly
		},
		async ({ book_id, from, to }) => {
			const pages = await listPages(db, book_id, from, to);
			const [book] = (await listBooks(db)).filter((b) => b.id === book_id);
			if (!book) return failure(`There is no Book ${book_id}.`);
			return json({
				book: { id: book.id, title: book.title, pageCount: book.pageCount },
				pages: pages.map((p) => ({ id: p.id, position: p.position, read: p.readAt !== null, words: p.words, text: p.text }))
			});
		}
	);

	server.registerTool(
		'edit_pages',
		{
			title: 'Edit Pages',
			description:
				"Cleans up a Book's Pages, naming them by id from get_pages: set_text, remove, join_next (joins the next Page onto it), move (after another Page, or first with after null), " +
				'add (new text after a Page, or first; a line containing only --- starts another Page), and optionally a new title. ' +
				'The operations apply in order and save at once, or not at all. Read Pages are the learner\'s and are refused: ask them first. ' +
				"Offer a cleanup after importing a page that looks messy; don't do it unasked.",
			inputSchema: {
				book_id: z.number().int(),
				title: z.string().optional(),
				operations: z.array(
					z.discriminatedUnion('op', [
						z.object({ op: z.literal('set_text'), page: z.number().int(), text: z.string() }),
						z.object({ op: z.literal('remove'), page: z.number().int() }),
						z.object({ op: z.literal('join_next'), page: z.number().int() }),
						z.object({ op: z.literal('move'), page: z.number().int(), after: z.number().int().nullable() }),
						z.object({ op: z.literal('add'), after: z.number().int().nullable(), text: z.string() })
					])
				)
			},
			annotations: { ...writes, destructiveHint: true }
		},
		async ({ book_id, title, operations }) =>
			guard(async () => {
				await editPagesAsTutor(db, book_id, { title, operations });
				const pages = await listPages(db, book_id);
				return json({ pages: pages.map((p) => ({ id: p.id, position: p.position, read: p.readAt !== null, words: p.words, start: p.text.slice(0, 80) })) });
			})
	);

	return server;
}

/** Turns a broken rule into an error result the Tutor can read and act on. */
async function guard(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof Refused) {
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
		...(term.parent ? { parent: term.parent.text, followsParent: term.followsParent } : {}),
		...(term.tutorAssessment ? { tutorAssessment: term.tutorAssessment } : {}),
		...(term.transfer ? { transfer: term.transfer } : {}),
		...(term.origin ? { origin: term.origin } : {}),
		...(term.frequency ? { frequency: term.frequency } : {}),
		...(term.practice
			? {
					practice: {
						due: term.practice.due,
						isDue: term.practice.overdue > 0,
						reviews: term.practice.reviews,
						...(term.practice.recall ? { recall: term.practice.recall.level } : {})
					}
				}
			: {})
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
