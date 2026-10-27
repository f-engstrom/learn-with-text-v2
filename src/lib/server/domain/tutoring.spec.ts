import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { findTerms, InvalidTerm, saveTerm } from './terms';
import { adjustLearning, linkParent, saveGloss } from './tutoring';

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const ru = (await listLanguages(db)).find((l) => l.code === 'ru')!.id;
	const get = async (key: string) => (await findTerms(db, ru, [key]))[key];
	return { db, ru, get };
}

describe('saveGloss', () => {
	it('gives an Unknown Word a Learning 1 Term with the Gloss from the Tutor', async () => {
		const { db, ru, get } = await setup();
		expect(await saveGloss(db, { languageId: ru, text: 'Мышь', gloss: ' mouse ' })).toMatchObject({ status: 'learning1', added: true });
		expect(await get('мышь')).toMatchObject({ text: 'мышь', status: 'learning1', translations: [{ text: 'mouse', source: 'tutor' }] });
	});

	it("adds to a Learning 1–2 Term's Translations, keeping theirs and their Sources, and not twice", async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'кот', status: 'learning2', translations: [{ text: 'cat', source: 'wiktionary' }] });
		await saveGloss(db, { languageId: ru, text: 'кот', gloss: 'tomcat' });
		expect(await saveGloss(db, { languageId: ru, text: 'КОТ', gloss: 'Cat' })).toMatchObject({ added: false });
		expect((await get('кот')).translations.map((t) => [t.text, t.source])).toEqual([
			['cat', 'wiktionary'],
			['tomcat', 'tutor']
		]);
		expect((await get('кот')).status).toBe('learning2');
	});

	it('refuses Terms at Learning 3–4, Known or Ignored', async () => {
		const { db, ru } = await setup();
		await saveTerm(db, { languageId: ru, text: 'дом', status: 'learning3' });
		await saveTerm(db, { languageId: ru, text: 'и', status: 'known' });
		await expect(saveGloss(db, { languageId: ru, text: 'дом', gloss: 'house' })).rejects.toThrow('“дом” is at Learning 3');
		await expect(saveGloss(db, { languageId: ru, text: 'и', gloss: 'and' })).rejects.toThrow(InvalidTerm);
		await expect(saveGloss(db, { languageId: ru, text: 'кот', gloss: ' ' })).rejects.toThrow('needs some text');
	});
});

describe('adjustLearning', () => {
	it('moves a Learning Term one step, staying within Learning 1–4', async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'кот', status: 'learning3' });
		expect(await adjustLearning(db, { languageId: ru, text: 'кот', direction: 'up' })).toEqual({ from: 'learning3', to: 'learning4' });
		expect(await adjustLearning(db, { languageId: ru, text: 'кот', direction: 'up' })).toEqual({ from: 'learning4', to: 'learning4' });
		expect((await get('кот')).status).toBe('learning4');
		await saveTerm(db, { languageId: ru, text: 'мышь', status: 'learning1' });
		expect(await adjustLearning(db, { languageId: ru, text: 'мышь', direction: 'down' })).toEqual({ from: 'learning1', to: 'learning1' });
	});

	it('never touches Unknown Words, Known or Ignored Terms', async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'и', status: 'known' });
		await saveTerm(db, { languageId: ru, text: 'москва', status: 'ignored' });
		await expect(adjustLearning(db, { languageId: ru, text: 'и', direction: 'down' })).rejects.toThrow('“и” is Known');
		await expect(adjustLearning(db, { languageId: ru, text: 'москва', direction: 'up' })).rejects.toThrow('Ignored');
		await expect(adjustLearning(db, { languageId: ru, text: 'дом', direction: 'up' })).rejects.toThrow('is Unknown');
		expect((await get('и')).status).toBe('known');
	});

	it('moves a Parent along with a Term that Follows it', async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'читала', status: 'learning2', parent: 'читать', followsParent: true });
		await adjustLearning(db, { languageId: ru, text: 'читала', direction: 'up' });
		expect((await get('читать')).status).toBe('learning3');
	});
});

describe('linkParent', () => {
	it('links a Term to its dictionary form, creating it at the Term’s Status, and keeps the rest of the Term', async () => {
		const { db, ru, get } = await setup();
		await saveGloss(db, { languageId: ru, text: 'набережной', gloss: 'seafront' });
		expect(await linkParent(db, { languageId: ru, text: 'Набережной', parent: 'набережная' })).toEqual({
			term: 'набережной',
			parent: 'набережная',
			createdParent: true
		});
		expect(await get('набережной')).toMatchObject({
			status: 'learning1',
			parent: { text: 'набережная', status: 'learning1' },
			followsParent: false,
			translations: [{ text: 'seafront', source: 'tutor' }]
		});
		expect((await get('набережная')).translations).toEqual([]);
	});

	it('uses an existing Parent without changing its Status, and says which one it replaced', async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'читать', status: 'known' });
		await saveTerm(db, { languageId: ru, text: 'читала', status: 'learning2', parent: 'читаться' });
		expect(await linkParent(db, { languageId: ru, text: 'читала', parent: 'Чита́ть' })).toEqual({
			term: 'читала',
			parent: 'читать',
			previousParent: 'читаться',
			createdParent: false
		});
		expect(await get('читала')).toMatchObject({ status: 'learning2', parent: { text: 'читать' }, followsParent: false });
		expect((await get('читать')).status).toBe('known');
	});

	it('leaves a Term that Follows its Parent where it is', async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'читать', status: 'known' });
		await saveTerm(db, { languageId: ru, text: 'читала', status: 'learning2', parent: 'читаться', followsParent: true });
		await expect(linkParent(db, { languageId: ru, text: 'читала', parent: 'читать' })).rejects.toThrow(
			'“читала” follows its Parent “читаться”; the learner changes that in the Reader.'
		);
		expect((await get('читать')).status).toBe('known');
		// Linking it to the Parent it already has is fine.
		await expect(linkParent(db, { languageId: ru, text: 'читала', parent: 'читаться' })).resolves.toMatchObject({ createdParent: false });
	});

	it('refuses an Unknown Word, a Term as its own Parent, and loops', async () => {
		const { db, ru } = await setup();
		await expect(linkParent(db, { languageId: ru, text: 'дом', parent: 'дом' })).rejects.toThrow('is Unknown');
		await saveTerm(db, { languageId: ru, text: 'дома', status: 'learning1', parent: 'дом' });
		await expect(linkParent(db, { languageId: ru, text: 'дома', parent: 'Дома' })).rejects.toThrow("can't be its own Parent");
		await expect(linkParent(db, { languageId: ru, text: 'дом', parent: 'дома' })).rejects.toThrow('is itself a form of');
	});
});
