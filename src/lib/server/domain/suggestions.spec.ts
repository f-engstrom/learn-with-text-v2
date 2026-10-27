import { describe, it, expect } from 'vitest';
import { rankSuggestions, type Suggestion } from '../../suggestions';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listBooks } from './books';
import { listLanguages } from './languages';
import { countWords, parserFor } from './parsing';
import { saveTerm } from './terms';
import { addTopic, InvalidTopic, listTopics, removeTopic } from './topics';
import {
	cutArticle,
	findSuggestions,
	getFitRange,
	importArticle,
	MIN_WORDS,
	setFitRange,
	unknownShareOf,
	type Article,
	type WikipediaSource
} from './suggestions';

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const languages = await listLanguages(db);
	const russian = languages.find((l) => l.code === 'ru')!;
	return { db, russian };
}

const russianParser = parserFor({ code: 'ru' });
/** `n` Words of Russian text, as Sentences of five. */
const words = (n: number, word = 'слово') =>
	Array.from({ length: Math.ceil(n / 5) }, (_, i) => Array(Math.min(5, n - i * 5)).fill(word).join(' ') + '.').join(' ');

function fake(articles: Record<string, string>, search: Record<string, string[]> = {}): WikipediaSource & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		search: async (topic) => (calls.push(`search:${topic}`), search[topic] ?? []),
		random: async () => (calls.push('random'), Object.keys(articles)),
		article: async (_code, title): Promise<Article | undefined> =>
			articles[title] === undefined ? undefined : { title, url: `https://ru.wikipedia.org/wiki/${title}`, text: articles[title] }
	};
}

describe('rankSuggestions', () => {
	const s = (title: string, unknownShare: number, more: Partial<Suggestion> = {}): Suggestion => ({
		title,
		url: title,
		unknownShare,
		pageCount: 2,
		...more
	});
	const range = { min: 0.05, max: 0.15 };
	const titles = (list: Suggestion[]) => rankSuggestions(list, range).map((x) => x.title);

	it('puts Suggestions inside the Fit range first, closest next', () => {
		expect(titles([s('hard', 0.6), s('fits', 0.1), s('easy', 0.01), s('nearly', 0.2)])).toEqual(['fits', 'easy', 'nearly', 'hard']);
	});

	it('then prefers a Topic, then one to three Pages', () => {
		expect(
			titles([s('long', 0.1, { topic: 't', pageCount: 4 }), s('random', 0.1), s('topic', 0.1, { topic: 't' }), s('short', 0.1, { topic: 't', pageCount: 0 })])
		).toEqual(['topic', 'long', 'short', 'random']);
	});

	it('re-ranks when the Fit range moves', () => {
		expect(rankSuggestions([s('a', 0.1), s('b', 0.4)], { min: 0.3, max: 0.5 }).map((x) => x.title)).toEqual(['b', 'a']);
	});
});

describe('cutArticle', () => {
	it('keeps a short article whole, with headings as lines', () => {
		expect(cutArticle(`${words(10)}\n\n\n== История ==\n${words(10)}`, russianParser)).toBe(`${words(10)}\nИстория\n${words(10)}`);
	});

	it('adds sections after the lead while it is under two Pages', () => {
		const text = [words(200), '== A ==', words(200), '== B ==', words(200), '== C ==', words(100)].join('\n');
		expect(cutArticle(text, russianParser).split('\n')).toEqual([words(200), 'A', words(200), 'B', words(200)]);
	});

	it('stops at the paragraph that would go past three Pages, but always keeps the lead', () => {
		const text = [words(300), '== A ==', words(150), words(400)].join('\n');
		expect(cutArticle(text, russianParser).split('\n')).toEqual([words(300), 'A', words(150)]);
		expect(cutArticle([words(900), words(10), '== A ==', words(10)].join('\n'), russianParser)).toBe(words(900));
	});

	it('drops a heading left with nothing under it', () => {
		expect(cutArticle([words(300), '== A ==', words(600)].join('\n'), russianParser)).toBe(words(300));
	});

	it('stops at the references', () => {
		expect(cutArticle([words(20), '== Примечания ==', 'Ссылка 1', '== Ещё ==', words(5)].join('\n'), russianParser)).toBe(words(20));
	});
});

describe('unknownShareOf', () => {
	it('is the share of distinct Words without a Term', async () => {
		const { db, russian } = await setup();
		await saveTerm(db, { languageId: russian.id, text: 'кот', status: 'learning1' });
		expect(await unknownShareOf(db, russian, 'Кот спит. Кот и мышь, 2024.')).toBeCloseTo(3 / 4);
		expect(await unknownShareOf(db, russian, '2024')).toBe(0);
	});
});

describe('Fit range', () => {
	it('defaults to 5–15% and is remembered per Language, in order and within 0–100%', async () => {
		const { db, russian } = await setup();
		expect(await getFitRange(db, russian.id)).toEqual({ min: 0.05, max: 0.15 });
		expect(await setFitRange(db, russian.id, { min: 0.3, max: -1 })).toEqual({ min: 0, max: 0.3 });
		expect(await getFitRange(db, russian.id)).toEqual({ min: 0, max: 0.3 });
		const other = (await listLanguages(db)).find((l) => l.code === 'zh')!;
		expect(await getFitRange(db, other.id)).toEqual({ min: 0.05, max: 0.15 });
	});
});

describe('Topics', () => {
	it('are added once whatever the case, and removed', async () => {
		const { db } = await setup();
		await addTopic(db, '  football ');
		await addTopic(db, 'Football');
		await addTopic(db, 'Roman  history');
		expect((await listTopics(db)).map((t) => t.text)).toEqual(['football', 'Roman history']);
		await removeTopic(db, (await listTopics(db))[0].id);
		expect((await listTopics(db)).map((t) => t.text)).toEqual(['Roman history']);
		await expect(addTopic(db, ' ')).rejects.toThrow(InvalidTopic);
	});
});

describe('findSuggestions', () => {
	it('uses random articles without Topics, leaving out stubs, and gives each its share and Pages', async () => {
		const { db, russian } = await setup();
		const source = fake({ Кот: words(MIN_WORDS, 'кот'), Заглушка: words(MIN_WORDS - 1) });
		const found = await findSuggestions(db, { wikipedia: source }, russian);
		expect(source.calls).toEqual(['random']);
		expect(found).toEqual([
			expect.objectContaining({ title: 'Кот', url: 'https://ru.wikipedia.org/wiki/Кот', topic: undefined, unknownShare: 1, pageCount: 1 })
		]);
	});

	it('searches for each Topic and says which Topic found each article', async () => {
		const { db, russian } = await setup();
		await addTopic(db, 'football');
		await addTopic(db, 'cats');
		const source = fake({ Футбол: words(100), Кошка: words(100) }, { football: ['Футбол'], cats: ['Кошка', 'Нет такой'] });
		const found = await findSuggestions(db, { wikipedia: source }, russian);
		expect(source.calls.toSorted()).toEqual(['search:cats', 'search:football']);
		expect(Object.fromEntries(found.map((f) => [f.title, f.topic]))).toEqual({ Футбол: 'football', Кошка: 'cats' });
	});

	it('never suggests an article you already have as a Book', async () => {
		const { db, russian } = await setup();
		const source = fake({ Кот: words(100), Мышь: words(100) });
		const id = await importArticle(db, source, russian, 'Кот');
		expect((await listBooks(db)).find((b) => b.id === id)?.title).toBe('Кот');
		expect((await findSuggestions(db, { wikipedia: source }, russian)).map((f) => f.title)).toEqual(['Мышь']);
		expect(await importArticle(db, source, russian, 'Кот')).toBe(id);
	});
});

describe('findSuggestions when Wikipedia fails', () => {
	it('skips an article or Topic that fails, but reports when everything did', async () => {
		const { db, russian } = await setup();
		await addTopic(db, 'football');
		await addTopic(db, 'cats');
		const flaky: WikipediaSource = {
			search: async (topic) => {
				if (topic === 'cats') throw new Error('429');
				return ['Футбол', 'Мяч'];
			},
			random: async () => [],
			article: async (_code, title) => {
				if (title === 'Мяч') throw new Error('429');
				return { title, url: title, text: words(100) };
			}
		};
		expect((await findSuggestions(db, { wikipedia: flaky }, russian)).map((f) => f.title)).toEqual(['Футбол']);

		const down: WikipediaSource = { ...flaky, search: async () => Promise.reject(new Error('429')) };
		await expect(findSuggestions(db, { wikipedia: down }, russian)).rejects.toThrow('429');
	});
});
