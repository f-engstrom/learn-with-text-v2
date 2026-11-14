import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateTo, migrateToLatest } from '../db/migrate';
import { azureFromWeb, lookUp, type AzureSource } from './azure';

function fake(
	dictionary: Record<string, [posTag: string, target: string][]>,
	translations: Record<string, string> = {}
): AzureSource & { asked: string[] } {
	const asked: string[] = [];
	return {
		asked,
		lookup: async (from, text) => (
			asked.push(`lookup ${from} ${text}`),
			{ translations: (dictionary[text] ?? []).map(([posTag, displayTarget]) => ({ posTag, displayTarget })) }
		),
		translate: async (from, text) => (asked.push(`translate ${from} ${text}`), translations[text] ?? '')
	};
}

const ru = { code: 'ru' };

describe('lookUp', () => {
	it('groups dictionary translations by part of speech, keeping their order', async () => {
		const source = fake({ стоит: [['VERB', 'costs'], ['VERB', 'stands'], ['ADV', 'worth'], ['VERB', 'costs']] });
		expect(await lookUp(source, ru, { normalised: 'стоит', text: 'Стоит' })).toEqual({
			kind: 'dictionary',
			entries: [
				{ partOfSpeech: 'verb', translations: ['costs', 'stands'] },
				{ partOfSpeech: 'adverb', translations: ['worth'] }
			]
		});
		expect(source.asked).toEqual(['lookup ru стоит']);
	});

	it("falls back to a machine translation of the text as written when the dictionary hasn't the Word", async () => {
		const source = fake({}, { Москва: 'Moscow' });
		expect(await lookUp(source, ru, { normalised: 'москва', text: 'Москва' })).toEqual({
			kind: 'translation',
			entries: [{ partOfSpeech: '', translations: ['Moscow'] }]
		});
	});

	it('machine-translates a phrase without looking it up', async () => {
		const source = fake({}, { 'потому что': 'because' });
		expect((await lookUp(source, ru, { normalised: 'потому что', text: 'потому что' }))?.kind).toBe('translation');
		expect(source.asked).toEqual(['translate ru потому что']);
	});

	it('asks for simplified Chinese', async () => {
		const source = fake({ 喜欢: [['VERB', 'like']] });
		await lookUp(source, { code: 'zh' }, { normalised: '喜欢', text: '喜欢' });
		expect(source.asked).toEqual(['lookup zh-Hans 喜欢']);
	});

	it("goes straight to a machine translation for a Language Azure has no dictionary for, as Albanian", async () => {
		const source = fake({}, { libri: 'the book' });
		expect(await lookUp(source, { code: 'sq' }, { normalised: 'libri', text: 'libri' })).toEqual({
			kind: 'translation',
			entries: [{ partOfSpeech: '', translations: ['the book'] }]
		});
		expect(source.asked).toEqual(['translate sq libri']);
	});

	it('returns nothing when Azure has no translation', async () => {
		expect(await lookUp(fake({}), ru, { normalised: 'ыы', text: 'ыы' })).toBeUndefined();
	});
});

describe('azureFromWeb', () => {
	it('sends the key and region, and asks once per text', async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		const fetchFn = (async (url: string, init: RequestInit) => {
			calls.push({ url, init });
			return Response.json([{ translations: [{ displayTarget: 'read', posTag: 'VERB' }] }]);
		}) as typeof fetch;
		const source = azureFromWeb('secret', 'northeurope', fetchFn);
		expect(await source.lookup('ru', 'читать')).toEqual({ translations: [{ displayTarget: 'read', posTag: 'VERB' }] });
		await source.lookup('ru', 'читать');
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe('https://api.cognitive.microsofttranslator.com/dictionary/lookup?api-version=3.0&from=ru&to=en');
		expect(calls[0].init.headers).toMatchObject({ 'Ocp-Apim-Subscription-Key': 'secret', 'Ocp-Apim-Subscription-Region': 'northeurope' });
		expect(calls[0].init.body).toBe('[{"Text":"читать"}]');
	});

	it('reads the translated text, and throws when Azure refuses', async () => {
		const ok = azureFromWeb('k', 'r', (async () => Response.json([{ translations: [{ text: 'Books', to: 'en' }] }])) as typeof fetch);
		expect(await ok.translate('bs', 'knjiga')).toBe('Books');
		const refused = azureFromWeb('k', 'r', (async () => new Response('', { status: 401 })) as typeof fetch);
		await expect(refused.translate('bs', 'knjiga')).rejects.toThrow('401');
	});
});

describe('the azure Source migration', () => {
	it('keeps Translations saved before it, and still moves the Terms version', async () => {
		const db = openDatabase(':memory:');
		await migrateTo(db, '0020-tutor-question-glosses');
		await db
			.insertInto('term')
			.values({ language_id: 1, text: 'кот', normalised: 'кот', status: 'learning1', created_at: '2026-01-05T10:00:00.000Z' })
			.execute();
		await db.insertInto('translation').values({ term_id: 1, position: 1, text: 'cat', source: 'wiktionary' }).execute();
		await migrateToLatest(db);
		const version = async () => (await db.selectFrom('language').select('terms_version').where('id', '=', 1).executeTakeFirstOrThrow()).terms_version;
		const before = await version();
		await db.insertInto('translation').values({ term_id: 1, position: 2, text: 'tomcat', source: 'azure' }).execute();
		expect(await version()).toBe(before + 1);
		expect(await db.selectFrom('translation').select(['text', 'source']).orderBy('position').execute()).toEqual([
			{ text: 'cat', source: 'wiktionary' },
			{ text: 'tomcat', source: 'azure' }
		]);
		await expect(db.insertInto('translation').values({ term_id: 1, position: 3, text: 'x', source: 'other' as 'you' }).execute()).rejects.toThrow();
	});
});
