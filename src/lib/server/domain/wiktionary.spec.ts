import { describe, it, expect } from 'vitest';
import { lookUp, plainText, wiktionaryFromWeb, type RawDefinitions, type WiktionarySource } from './wiktionary';

const entry = (partOfSpeech: string, ...definitions: string[]) => ({
	partOfSpeech,
	definitions: definitions.map((definition) => ({ definition }))
});

function fake(pages: Record<string, RawDefinitions>, wikitexts: Record<string, string> = {}): WiktionarySource & { asked: string[] } {
	const asked: string[] = [];
	return {
		asked,
		definitions: async (title) => (asked.push(title), pages[title]),
		wikitext: async (title) => wikitexts[title]
	};
}

const ru = { code: 'ru' };

describe('plainText', () => {
	it('removes tags, decodes entities and tidies spacing', () => {
		expect(
			plainText('to <a rel="mw:WikiLink" href="/wiki/like" title="like">like</a>; to be <b>fond</b>&nbsp;of &amp; more <span class="x"></span> ( informal ) .')
		).toBe('to like; to be fond of & more (informal).');
		expect(plainText('&#1095;&#x438;')).toBe('чи');
	});
});

describe('lookUp', () => {
	it("returns the definitions in the Language's section only", async () => {
		const source = fake({
			люблю: { uk: [entry('Verb', 'Ukrainian')], ru: [entry('Verb', 'first-person singular of <i>любить</i>', '')] }
		});
		expect(await lookUp(source, ru, { normalised: 'люблю', text: 'Люблю' })).toEqual({
			title: 'люблю',
			entries: [{ partOfSpeech: 'Verb', definitions: ['first-person singular of любить'] }]
		});
	});

	it('lists a definition once when two senses read the same', async () => {
		const source = fake({ мышь: { ru: [entry('Noun', 'mouse', '<i>mouse</i>', 'computer mouse')] } });
		expect((await lookUp(source, ru, { normalised: 'мышь', text: 'мышь' }))?.entries[0].definitions).toEqual(['mouse', 'computer mouse']);
	});

	it('looks Bosnian up under Serbo-Croatian', async () => {
		const source = fake({ knjiga: { sh: [entry('Noun', 'book')], other: [] } });
		expect((await lookUp(source, { code: 'bs' }, { normalised: 'knjiga', text: 'knjiga' }))?.entries[0].definitions).toEqual(['book']);
	});

	it('falls back to the text as written, e.g. for names', async () => {
		const source = fake({ Москва: { ru: [entry('Proper noun', 'Moscow')] } });
		expect((await lookUp(source, ru, { normalised: 'москва', text: 'Москва' }))?.title).toBe('Москва');
		expect(source.asked).toEqual(['москва', 'Москва']);
	});

	it('follows a simplified Chinese page to its traditional form', async () => {
		const source = fake({ 喜歡: { zh: [entry('Verb', 'to like')] } }, { 喜欢: '==Chinese==\n{{zh-see|喜歡}}' });
		expect(await lookUp(source, { code: 'zh' }, { normalised: '喜欢', text: '喜欢' })).toEqual({
			title: '喜歡',
			entries: [{ partOfSpeech: 'Verb', definitions: ['to like'] }]
		});
	});

	it('returns nothing when no page has the Language', async () => {
		expect(await lookUp(fake({ кот: { uk: [entry('Noun', 'x')] } }), ru, { normalised: 'кот', text: 'кот' })).toBeUndefined();
	});
});

describe('wiktionaryFromWeb', () => {
	it('asks once per page, with a User-Agent, and treats 404 as no page', async () => {
		const urls: string[] = [];
		const fetchFn = (async (url: string, init?: RequestInit) => {
			urls.push(url);
			expect(new Headers(init?.headers).get('User-Agent')).toContain('Reader');
			return url.includes('missing') ? new Response('', { status: 404 }) : Response.json({ ru: [] });
		}) as typeof fetch;
		const source = wiktionaryFromWeb(fetchFn);
		expect(await source.definitions('в течение')).toEqual({ ru: [] });
		await source.definitions('в течение');
		expect(await source.definitions('missing')).toBeUndefined();
		expect(urls).toEqual([
			'https://en.wiktionary.org/api/rest_v1/page/definition/%D0%B2_%D1%82%D0%B5%D1%87%D0%B5%D0%BD%D0%B8%D0%B5',
			'https://en.wiktionary.org/api/rest_v1/page/definition/missing'
		]);
	});
});
