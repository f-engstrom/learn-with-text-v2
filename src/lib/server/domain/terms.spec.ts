import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { createBook, getPage } from './books';
import { deleteTerm, findTerms, InvalidTerm, saveTerm } from './terms';

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const byName = Object.fromEntries((await listLanguages(db)).map((l) => [l.name, l.id]));
	return { db, byName };
}

const texts = (term: { translations: { text: string }[] } | undefined) => term?.translations.map((t) => t.text);

describe('saveTerm', () => {
	it('creates a Term with its Translations in order, from you', async () => {
		const { db, byName } = await setup();
		const id = await saveTerm(db, {
			languageId: byName.Russian,
			text: 'Чита́ть',
			status: 'learning2',
			translations: [{ text: ' to read ' }, { text: '' }, { text: 'to study' }]
		});
		const term = (await findTerms(db, byName.Russian, ['читать'])).читать;
		expect(term).toMatchObject({ id, text: 'чита́ть', status: 'learning2', pronunciation: '' });
		expect(term.translations.map(({ text, source }) => ({ text, source }))).toEqual([
			{ text: 'to read', source: 'you' },
			{ text: 'to study', source: 'you' }
		]);
	});

	it('updates the Term with the same Normalised form instead of adding one', async () => {
		const { db, byName } = await setup();
		const first = await saveTerm(db, { languageId: byName.Russian, text: 'читать', status: 'learning1', translations: [{ text: 'read' }] });
		const second = await saveTerm(db, { languageId: byName.Russian, text: 'ЧИТА́ТЬ', status: 'known', translations: [] });
		expect(second).toBe(first);
		expect((await findTerms(db, byName.Russian, ['читать'])).читать).toMatchObject({ text: 'читать', status: 'known', translations: [] });
		expect(await db.selectFrom('term').select('id').execute()).toHaveLength(1);
	});

	it('reorders Translations and keeps the Source of unchanged ones', async () => {
		const { db, byName } = await setup();
		const id = await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1', translations: [{ text: 'cat' }] });
		await db.updateTable('translation').set({ source: 'wiktionary' }).where('term_id', '=', id).execute();
		const [wiktionary] = (await findTerms(db, byName.Russian, ['кот'])).кот.translations;

		await saveTerm(db, {
			languageId: byName.Russian,
			text: 'кот',
			status: 'learning1',
			translations: [{ text: 'tomcat' }, { id: wiktionary.id, text: 'cat' }]
		});
		const after = (await findTerms(db, byName.Russian, ['кот'])).кот.translations;
		expect(after.map(({ text, source }) => ({ text, source }))).toEqual([
			{ text: 'tomcat', source: 'you' },
			{ text: 'cat', source: 'wiktionary' }
		]);
	});

	it('makes an edited Translation yours', async () => {
		const { db, byName } = await setup();
		const id = await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1', translations: [{ text: 'cat' }] });
		await db.updateTable('translation').set({ source: 'tutor' }).where('term_id', '=', id).execute();
		const [tutor] = (await findTerms(db, byName.Russian, ['кот'])).кот.translations;

		await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1', translations: [{ id: tutor.id, text: 'male cat' }] });
		expect((await findTerms(db, byName.Russian, ['кот'])).кот.translations[0]).toMatchObject({ text: 'male cat', source: 'you' });
	});

	it('removes Translations left out', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1', translations: [{ text: 'cat' }, { text: 'tomcat' }] });
		const [cat] = (await findTerms(db, byName.Russian, ['кот'])).кот.translations;
		await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1', translations: [{ id: cat.id, text: 'cat' }] });
		expect(texts((await findTerms(db, byName.Russian, ['кот'])).кот)).toEqual(['cat']);
	});

	it('keeps Terms apart per Language', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Bosnian, text: 'da', status: 'known', translations: [] });
		expect(await findTerms(db, byName.Russian, ['da'])).toEqual({});
	});

	it('matches Farsi Words spelled with Arabic letters', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Farsi, text: 'كتاب', status: 'learning1', translations: [{ text: 'book' }] });
		expect(texts((await findTerms(db, byName.Farsi, ['کتاب']))['کتاب'])).toEqual(['book']);
	});

	it.each([
		[{ status: 'learning5' }, 'Status'],
		[{ text: '  ' }, 'text'],
		[{ languageId: 999 }, 'Language']
	])('rejects %o', async (override, message) => {
		const { db, byName } = await setup();
		const input = { languageId: byName.Russian, text: 'кот', status: 'learning1', translations: [], ...override };
		await expect(saveTerm(db, input)).rejects.toThrow(InvalidTerm);
		await expect(saveTerm(db, input)).rejects.toThrow(message);
	});
});

describe('saving only a Status', () => {
	it('keeps the Translations and Pronunciation of an existing Term', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Chinese, text: '喜欢', status: 'learning1', translations: [{ text: 'to like' }] });
		await saveTerm(db, { languageId: byName.Chinese, text: '喜欢', status: 'learning3' });
		expect((await findTerms(db, byName.Chinese, ['喜欢']))['喜欢']).toMatchObject({
			status: 'learning3',
			pronunciation: 'xǐhuan',
			translations: [{ text: 'to like' }]
		});
	});

	it('creates a Term for an Unknown Word', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Russian, text: 'Кот', status: 'known' });
		expect((await findTerms(db, byName.Russian, ['кот'])).кот).toMatchObject({ text: 'кот', status: 'known', translations: [] });
	});
});

describe('Pronunciation', () => {
	it('fills in pinyin for a new Chinese Term', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Chinese, text: '喜欢', status: 'learning1', translations: [] });
		expect((await findTerms(db, byName.Chinese, ['喜欢']))['喜欢'].pronunciation).toBe('xǐhuan');
	});

	it('uses the Pronunciation you give instead', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Chinese, text: '长大', status: 'learning1', pronunciation: 'zhǎng dà', translations: [] });
		expect((await findTerms(db, byName.Chinese, ['长大']))['长大'].pronunciation).toBe('zhǎng dà');
	});

	it('lets you clear it on an existing Term, and keeps it when omitted', async () => {
		const { db, byName } = await setup();
		const save = (pronunciation?: string) =>
			saveTerm(db, { languageId: byName.Chinese, text: '你好', status: 'learning1', pronunciation, translations: [] });
		await save();
		await save(undefined);
		expect((await findTerms(db, byName.Chinese, ['你好']))['你好'].pronunciation).toBe('nǐhǎo');
		await save('');
		expect((await findTerms(db, byName.Chinese, ['你好']))['你好'].pronunciation).toBe('');
	});

	it('is not filled in for other Languages', async () => {
		const { db, byName } = await setup();
		await saveTerm(db, { languageId: byName.Farsi, text: 'کتاب', status: 'learning1', translations: [] });
		expect((await findTerms(db, byName.Farsi, ['کتاب']))['کتاب'].pronunciation).toBe('');
	});
});

describe('deleteTerm', () => {
	it('removes the Term and its Translations', async () => {
		const { db, byName } = await setup();
		const id = await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning1', translations: [{ text: 'cat' }] });
		await deleteTerm(db, id);
		expect(await findTerms(db, byName.Russian, ['кот'])).toEqual({});
		expect(await db.selectFrom('translation').select('id').execute()).toEqual([]);
	});
});

describe('getPage with Terms', () => {
	it('gives every Word its Normalised form and returns the matching Terms', async () => {
		const { db, byName } = await setup();
		const bookId = await createBook(db, { languageId: byName.Russian, title: 'Кот', text: 'Кот чита́ет. Кот спит.' });
		const termId = await saveTerm(db, { languageId: byName.Russian, text: 'кот', status: 'learning3', translations: [{ text: 'cat' }] });

		const page = await getPage(db, bookId, 1);
		const words = page!.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t) => t.isWord)));
		expect(words.map((w) => w.key)).toEqual(['кот', 'читает', 'кот', 'спит']);
		expect(words.map((w) => [w.index, w.sentence])).toEqual([[0, 0], [1, 0], [2, 1], [3, 1]]);
		expect(Object.keys(page!.terms)).toEqual(['кот']);
		expect(page!.terms.кот).toMatchObject({ id: termId, status: 'learning3' });
		expect(texts(page!.terms.кот)).toEqual(['cat']);
	});
});

describe('Multi-word Terms', () => {
	const shown = (page: Awaited<ReturnType<typeof getPage>>) =>
		page!.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.flatMap((t) => (t.key ? [`${t.text}:${page!.terms[t.key]?.status ?? 'unknown'}`] : []))));

	it('saves a phrase by its Normalised form, however it was spaced', async () => {
		const { db, byName } = await setup();
		const id = await saveTerm(db, { languageId: byName.Russian, text: ' В  тече́ние ', status: 'learning1' });
		expect((await findTerms(db, byName.Russian, ['в течение']))['в течение']).toMatchObject({ id, text: 'в тече́ние' });
	});

	it('shows a matched phrase as one Term on the Page, and its Words again once it is deleted', async () => {
		const { db, byName } = await setup();
		const bookId = await createBook(db, { languageId: byName.Russian, title: 't', text: 'В течение дня кот спит.' });
		const id = await saveTerm(db, { languageId: byName.Russian, text: 'в течение', status: 'learning2' });
		expect(shown(await getPage(db, bookId, 1))).toEqual(['В течение:learning2', 'дня:unknown', 'кот:unknown', 'спит:unknown']);
		const page = await getPage(db, bookId, 1);
		expect(page!.paragraphs[0].sentences[0].tokens[0]).toMatchObject({ index: 0, words: 2 });
		await deleteTerm(db, id);
		expect(shown(await getPage(db, bookId, 1))).toEqual(['В:unknown', 'течение:unknown', 'дня:unknown', 'кот:unknown', 'спит:unknown']);
	});

	it('shows Chinese segments written together as one Term', async () => {
		const { db, byName } = await setup();
		const bookId = await createBook(db, { languageId: byName.Chinese, title: 't', text: '我喜欢猫。' });
		const words = shown(await getPage(db, bookId, 1));
		await saveTerm(db, { languageId: byName.Chinese, text: '喜欢猫', status: 'learning1' });
		expect(shown(await getPage(db, bookId, 1))).toContain('喜欢猫:learning1');
		expect(words.length).toBeGreaterThan(shown(await getPage(db, bookId, 1)).length);
	});

	it('does not match across punctuation', async () => {
		const { db, byName } = await setup();
		const bookId = await createBook(db, { languageId: byName.Russian, title: 't', text: 'В, течение.' });
		await saveTerm(db, { languageId: byName.Russian, text: 'в течение', status: 'learning2' });
		expect(shown(await getPage(db, bookId, 1))).toEqual(['В:unknown', 'течение:unknown']);
	});

	it('rejects punctuation and phrases that are too long', async () => {
		const { db, byName } = await setup();
		await expect(saveTerm(db, { languageId: byName.Russian, text: 'кот, мышь', status: 'known' })).rejects.toThrow(InvalidTerm);
		await expect(saveTerm(db, { languageId: byName.Russian, text: 'а б в г д е ж з', status: 'known' })).rejects.toThrow(InvalidTerm);
	});
});

describe('Parents', () => {
	const ru = async () => {
		const { db, byName } = await setup();
		const save = (text: string, status: string, more: Partial<Parameters<typeof saveTerm>[1]> = {}) =>
			saveTerm(db, { languageId: byName.Russian, text, status, ...more });
		const get = async (text: string) => (await findTerms(db, byName.Russian, [text]))[text];
		return { db, byName, save, get };
	};

	it('creates a missing Parent with the Status of its Child', async () => {
		const { save, get } = await ru();
		await save('читала', 'learning2', { parent: 'Чита́ть' });
		expect(await get('читать')).toMatchObject({ text: 'чита́ть', status: 'learning2', parent: undefined });
		expect(await get('читала')).toMatchObject({ parent: { text: 'чита́ть', status: 'learning2' }, followsParent: false });
	});

	it('uses the existing Term as Parent, and keeps or removes it', async () => {
		const { db, save, get } = await ru();
		const parentId = await save('читать', 'known');
		await save('читала', 'learning1', { parent: 'читать' });
		expect((await get('читала')).parent?.id).toBe(parentId);
		expect((await get('читать')).status).toBe('known');
		await save('читала', 'learning2');
		expect((await get('читала')).parent?.id).toBe(parentId);
		await save('читала', 'learning2', { parent: ' ' });
		expect((await get('читала')).parent).toBeUndefined();
		expect(await db.selectFrom('term').select('id').execute()).toHaveLength(2);
	});

	it('without Follows Parent, Statuses stay separate', async () => {
		const { save, get } = await ru();
		await save('читала', 'learning1', { parent: 'читать' });
		await save('читать', 'known');
		expect((await get('читала')).status).toBe('learning1');
	});

	it('with Follows Parent, a Term and its Parent share one Status, whichever changes', async () => {
		const { save, get } = await ru();
		await save('читать', 'known');
		await save('читала', 'learning3', { parent: 'читать', followsParent: true });
		expect((await get('читать')).status).toBe('learning3');
		await save('читать', 'learning4');
		expect((await get('читала')).status).toBe('learning4');
		await save('читаю', 'learning1', { parent: 'читать', followsParent: true });
		expect([(await get('читать')).status, (await get('читала')).status]).toEqual(['learning1', 'learning1']);
	});

	it('rejects a Term as its own Parent, or a loop', async () => {
		const { save } = await ru();
		await expect(save('читать', 'known', { parent: 'Чита́ть' })).rejects.toThrow(InvalidTerm);
		await save('читала', 'learning1', { parent: 'читать' });
		await expect(save('читать', 'known', { parent: 'читала' })).rejects.toThrow('“читала” is itself a form of “читать”.');
	});

	it('deleting a Parent leaves its Children without one', async () => {
		const { db, save, get } = await ru();
		const parentId = await save('читать', 'known');
		await save('читала', 'learning1', { parent: 'читать', followsParent: true });
		await deleteTerm(db, parentId);
		expect(await get('читала')).toMatchObject({ parent: undefined, followsParent: false, status: 'learning1' });
	});
});
