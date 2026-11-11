/**
 * Builds the stories' fixtures with the domain itself: a database in memory, filled through the same
 * functions the web app and the Tutor call, read back through the ones the routes' loads call. A story
 * therefore can't show a state the Reader can't reach. `pnpm fixtures` writes the result to fixtures.json.
 */
import { sql, type Kysely } from 'kysely';
import { migrateToLatest } from '../lib/server/db/migrate';
import { openDatabase } from '../lib/server/db/open';
import type { Database } from '../lib/server/db/schema';
import { createBook, getPage, listBooks } from '../lib/server/domain/books';
import { CLASSICS } from '../lib/server/domain/classics';
import { listDictionaries } from '../lib/server/domain/dictionaries';
import { addFeed, listFeeds } from '../lib/server/domain/feeds';
import { askLearner, answerTutor, fromTutor } from '../lib/server/domain/from-tutor';
import { listLanguages, type Language } from '../lib/server/domain/languages';
import { findExample, recordReview } from '../lib/server/domain/practice';
import { daySoFar, getProgress } from '../lib/server/domain/progress';
import { clearHighlight, latestBookmark, markPageRead, setBookmark, setHighlight } from '../lib/server/domain/reading';
import { getFitRange } from '../lib/server/domain/suggestions';
import { listTerms, saveTerm, TERM_PAGE_SIZE } from '../lib/server/domain/terms';
import { addTopic, listTopics } from '../lib/server/domain/topics';
import { assessTerm, saveGloss, setTransfer } from '../lib/server/domain/tutoring';
import { listYourLanguages, setYourLanguage } from '../lib/server/domain/your-languages';
import { releaseClock, setClock } from './clock';
import { analects, feedXml, lady, saadi, vanka } from './texts';

/** The moment every fixture is read at: the stories' "now". */
export const NOW = '2026-11-10T12:00:00.000Z';

const daysAgo = (days: number) => new Date(Date.parse(NOW) - days * 86_400_000).toISOString();

/** A database with a clock: what is done inside `on` is stamped that many days before NOW. */
async function world() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	let stamped = 0;
	const on = async <T>(days: number, work: () => Promise<T>): Promise<T> => {
		setClock(daysAgo(days));
		const result = await work();
		// The Status history is stamped by SQLite's own clock (ADR 0005), which no fixture can set.
		await db.updateTable('status_change').set({ changed_at: daysAgo(days) }).where('id', '>', stamped).execute();
		const last = await db.selectFrom('status_change').select(sql<number>`coalesce(max(id), 0)`.as('id')).executeTakeFirstOrThrow();
		stamped = last.id;
		return result;
	};
	const languages = await listLanguages(db);
	const language = (code: string) => languages.find((l) => l.code === code)!;
	return { db, on, language };
}

/** What the reading screen's load returns. */
async function reading(db: Kysely<Database>, bookId: number, position: number, read = false) {
	const page = (await getPage(db, bookId, position))!;
	return {
		...page,
		dictionaries: await listDictionaries(db, page.language.id),
		...(await fromTutor(db, bookId))!,
		daySoFar: read ? await daySoFar(db, page.language.id) : null
	};
}

/** What the Term list's load returns with no filter. */
async function termList(db: Kysely<Database>) {
	const { terms, total } = await listTerms(db, { limit: TERM_PAGE_SIZE, offset: 0 });
	return {
		languages: await listLanguages(db),
		filter: { language: '', status: '', source: '', q: '', due: '', recall: '', frequency: '' },
		terms,
		total,
		page: 1,
		pageSize: TERM_PAGE_SIZE
	};
}

async function review(db: Kysely<Database>) {
	const { terms, total } = await listTerms(db, { due: 'due', limit: 1 });
	const languages = await listLanguages(db);
	const term = terms[0];
	return {
		languages,
		languageId: '',
		remaining: total,
		term: term && { ...term, language: languages.find((l) => l.id === term.languageId)! },
		example: term && (await findExample(db, term.id))
	};
}

async function home(db: Kysely<Database>) {
	const due = await listTerms(db, { due: 'due', limit: 1 });
	return { languages: await listLanguages(db), books: await listBooks(db), latest: await latestBookmark(db), due: due.total };
}

async function suggestions(db: Kysely<Database>, language: Language) {
	return {
		language,
		fitRange: await getFitRange(db, language.id),
		topics: await listTopics(db),
		feeds: await listFeeds(db, language.id),
		classics: CLASSICS[language.code]?.length ?? 0
	};
}

/** Every route's data for one database, apart from the reading screen's. */
async function routes(db: Kysely<Database>, russian: Language) {
	return {
		home: await home(db),
		terms: await termList(db),
		review: await review(db),
		progress: { languages: await getProgress(db) },
		feeds: { languages: await listLanguages(db), feeds: await listFeeds(db) },
		you: { languages: await listYourLanguages(db) },
		topics: { topics: await listTopics(db) },
		newBook: { languages: await listLanguages(db) },
		suggestions: await suggestions(db, russian)
	};
}

/** A Reader nobody has used yet: one Book, no Terms. */
async function emptyWorld() {
	const { db, on, language } = await world();
	const russian = language('ru');
	const bookId = await on(0, () => createBook(db, { languageId: russian.id, title: 'Дама с собачкой', text: lady }));
	const fresh = await reading(db, bookId, 1);
	await db.deleteFrom('book').execute();
	return { fresh, routes: await routes(db, russian) };
}

/** A Reader some weeks in: Terms in every Status, Reviews, Pages read, and the Tutor at work. */
async function readerWorld() {
	const { db, on, language } = await world();
	const [russian, farsi, chinese] = [language('ru'), language('fa'), language('zh')];
	const save = (lang: Language, text: string, status: string, more: Partial<Parameters<typeof saveTerm>[1]> = {}) =>
		saveTerm(db, { languageId: lang.id, text, status, ...more });
	const meaning = (text: string, source?: string) => ({ translations: [{ text, source }] });

	const books = await on(40, async () => {
		await setYourLanguage(db, { name: 'Swedish', level: 'native' });
		await setYourLanguage(db, { name: 'English', level: 'fluent' });
		await setYourLanguage(db, { name: 'Bosnian', level: 'some' });
		await addTopic(db, 'история');
		await addTopic(db, 'космос');
		await addFeed(db, async () => feedXml, { languageId: russian.id, url: 'https://example.org/science.xml' });
		return {
			vanka: await createBook(db, { languageId: russian.id, title: 'Ванька', text: vanka }),
			// Long enough to pass the first Milestone: the same opening, many times over.
			stories: await createBook(db, { languageId: russian.id, title: 'Рассказы', text: Array(110).fill(lady).join('\n---\n') }),
			lady: await createBook(db, { languageId: russian.id, title: 'Дама с собачкой', text: lady }),
			saadi: await createBook(db, { languageId: farsi.id, title: 'بنی آدم', text: saadi }),
			analects: await createBook(db, { languageId: chinese.id, title: '论语', text: analects })
		};
	});

	// The common Words, Known from the start.
	await on(40, async () => {
		const known =
			'говорили что на новое с в уже две недели и тоже стал он как по прошла молодая за белый тут у видел она его не был была это';
		for (const word of known.split(' ')) await save(russian, word, 'known');
		for (const name of ['Дмитрий', 'Дмитрич', 'Гуров', 'Ялте', 'Верне']) await save(russian, name, 'ignored');
	});

	// Terms being learned, saved over the weeks, with a Translation from every Source.
	const terms = await on(30, async () => ({
		face: await save(russian, 'лицо', 'learning4', meaning('face; person')),
		faces: await save(russian, 'лицами', 'learning4', { ...meaning('faces (instrumental)'), parent: 'лицо', followsParent: true }),
		interested: await save(russian, 'интересоваться', 'learning3', {
			translations: [{ text: 'to be interested in' }, { text: 'to take an interest', source: 'wiktionary' }]
		}),
		lived: await save(russian, 'проживший', 'learning3', meaning('having lived', 'azure')),
		appeared: await save(russian, 'появилось', 'learning2', meaning('appeared', 'wiktionary')),
		used: await save(russian, 'привыкший', 'learning2', meaning('accustomed')),
		lady: await save(russian, 'дама с собачкой', 'learning2', meaning('the lady with the little dog')),
		pavilion: await save(russian, 'павильоне', 'learning1', meaning('pavilion'))
	}));
	await on(12, async () => {
		await saveGloss(db, { languageId: russian.id, text: 'набережной', gloss: 'embankment, seafront' });
		await setTransfer(db, {
			languageId: russian.id,
			text: 'интересоваться',
			form: 'easy',
			concept: 'medium',
			reason: 'Close to English "interest"; takes the instrumental.'
		});
	});

	// Reviews: some Terms are well held, some long overdue.
	await on(28, () => recordReview(db, terms.face, 'got', 'page'));
	await on(24, () => recordReview(db, terms.face, 'got', 'list'));
	await on(26, () => recordReview(db, terms.interested, 'hard', 'page'));
	await on(20, () => recordReview(db, terms.appeared, 'missed', 'page'));
	await on(9, () => recordReview(db, terms.used, 'got', 'page'));
	await on(3, () => recordReview(db, terms.lived, 'got', 'list'));
	await on(2, () => assessTerm(db, { languageId: russian.id, text: 'интересоваться', answer: 'got' }));
	await on(1, () => assessTerm(db, { languageId: russian.id, text: 'появилось', answer: 'hard' }));

	// Reading on several days, for Words read and the weeks.
	await on(23, () => markPageRead(db, books.vanka, 1));
	await on(16, () => markPageRead(db, books.vanka, 2));
	await on(5, () => markPageRead(db, books.lady, 3));
	// Pages of the long Book, more on some days than others, none on a few.
	const pagesRead = [9, 0, 14, 6, 0, 0, 11, 8, 3, 0, 12, 7, 0, 5, 10, 0, 4, 9, 0, 6, 13, 2, 0, 8, 5, 0, 7, 3, 4, 0, 6, 2, 5, 0, 3];
	let position = 1;
	for (const [i, pages] of pagesRead.entries()) {
		await on(pagesRead.length - i, async () => {
			for (let n = 0; n < pages; n++) await markPageRead(db, books.stories, position++);
		});
	}

	// Farsi and Chinese: a right-to-left Page, and Words whose characters are Terms of their own.
	await on(8, async () => {
		await save(farsi, 'آدم', 'known', meaning('human, Adam'));
		await save(farsi, 'اعضای', 'learning1', meaning('limbs, members'));
		await save(farsi, 'آفرینش', 'learning3', meaning('creation'));
		await save(farsi, 'درد', 'learning2', meaning('pain'));
		await save(chinese, '学习', 'learning2', meaning('to study'));
		await save(chinese, '学', 'learning4', meaning('to learn'));
		await save(chinese, '喜欢', 'learning1', meaning('to like'));
		await save(chinese, '今天', 'known', meaning('today'));
		await save(chinese, '不', 'known', meaning('not'));
	});

	setClock(NOW);
	await setBookmark(db, books.lady, { page: 1, sentence: 2, word: 'привыкший' });

	const mixed = await reading(db, books.lady, 1);
	const lastPage = await reading(db, books.lady, 3);
	const rightToLeft = await reading(db, books.saadi, 1);
	const characters = await reading(db, books.analects, 1);
	const everyRoute = await routes(db, russian);

	// From the Tutor, a step at a time: each is what the reading screen's load adds to the Page.
	await setHighlight(db, books.lady, { page: 1, first: 2, last: 2 });
	const highlight = await fromTutor(db, books.lady);
	await setHighlight(db, books.lady, {
		page: 1,
		first: 2,
		last: 2,
		text: 'проживший в Ялте уже две недели и привыкший тут',
		note: 'Two participles describe Gurov: проживший (having lived) and привыкший (having got used to).'
	});
	const passage = await fromTutor(db, books.lady);
	const asked = await askLearner(db, books.lady, {
		feedback: 'Right: появилось is neuter because лицо is.',
		glosses: [
			{ text: 'набережная', gloss: 'embankment, seafront' },
			{ text: 'привыкнуть', gloss: 'to get used to' }
		],
		questions: [
			{ prompt: 'Who is the new face on the seafront?', options: ['A lady with a dog', 'Gurov', 'A student'] },
			{ prompt: 'What does «привыкший тут» tell you about Gurov?' }
		]
	});
	const question = await fromTutor(db, books.lady);
	await answerTutor(db, books.lady, asked.askedAt, { answers: ['A lady with a dog', 'He has settled in.'] });
	const answered = await fromTutor(db, books.lady);
	await clearHighlight(db, books.lady);

	// A day's reading, then Mark as read, which sends you to the next Page with the day so far.
	await on(0, async () => {
		await save(russian, 'шпиц', 'learning1', meaning('spitz (a small dog)'));
		await save(russian, 'блондинка', 'learning1', meaning('a blonde'));
		await save(russian, 'берете', 'known');
		await recordReview(db, terms.pavilion, 'got', 'page');
		await recordReview(db, terms.used, 'hard', 'page');
		await markPageRead(db, books.lady, 1);
	});
	const afterRead = await reading(db, books.lady, 2, true);

	return {
		reading: { mixed, lastPage, rightToLeft, characters, afterRead },
		tutor: { highlight, passage, question, answered },
		routes: everyRoute
	};
}

export async function buildFixtures() {
	try {
		const empty = await emptyWorld();
		const reader = await readerWorld();
		// Through JSON, so what is compared with the committed file is what a story would import.
		return JSON.parse(
			JSON.stringify({
				now: NOW,
				reading: { fresh: empty.fresh, ...reader.reading },
				tutor: reader.tutor,
				routes: reader.routes,
				emptyRoutes: empty.routes
			})
		);
	} finally {
		releaseClock();
	}
}

export type Fixtures = Awaited<ReturnType<typeof buildFixtures>>;
