import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { findTerms, InvalidTerm, saveTerm } from './terms';
import { assessTerm, linkParent, saveGloss, setTransfer } from './tutoring';

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

describe('assessTerm', () => {
	it("moves the Tutor's assessment from the Status, one step per answer, and never the Status", async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'кот', status: 'learning3' });
		expect(await assessTerm(db, { languageId: ru, text: 'кот', answer: 'got' })).toMatchObject({ status: 'learning3', to: 'learning4' });
		expect(await assessTerm(db, { languageId: ru, text: 'кот', answer: 'got' })).toMatchObject({ from: 'learning4', to: 'known' });
		expect(await assessTerm(db, { languageId: ru, text: 'кот', answer: 'got' })).toMatchObject({ to: 'known' });
		expect(await assessTerm(db, { languageId: ru, text: 'кот', answer: 'hard' })).toMatchObject({ to: 'known' });
		expect(await get('кот')).toMatchObject({ status: 'learning3', tutor: 'known' });
		await saveTerm(db, { languageId: ru, text: 'мышь', status: 'learning1' });
		expect(await assessTerm(db, { languageId: ru, text: 'мышь', answer: 'missed' })).toMatchObject({ to: 'learning1' });
	});

	it('counts the answer as a Review for a Learning Term, but not for a Known one', async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'кот', status: 'learning2' });
		expect((await assessTerm(db, { languageId: ru, text: 'кот', answer: 'got' })).practice).toMatchObject({ reviews: 1 });
		expect((await get('кот')).practice).toMatchObject({ reviews: 1 });
		await saveTerm(db, { languageId: ru, text: 'и', status: 'known' });
		expect(await assessTerm(db, { languageId: ru, text: 'и', answer: 'missed' })).toEqual({ status: 'known', to: 'learning4' });
	});

	it('refuses Unknown Words and Ignored Terms', async () => {
		const { db, ru } = await setup();
		await saveTerm(db, { languageId: ru, text: 'москва', status: 'ignored' });
		await expect(assessTerm(db, { languageId: ru, text: 'москва', answer: 'got' })).rejects.toThrow('Ignored');
		await expect(assessTerm(db, { languageId: ru, text: 'дом', answer: 'got' })).rejects.toThrow('is Unknown');
		await expect(assessTerm(db, { languageId: ru, text: 'москва', answer: 'great' })).rejects.toThrow(InvalidTerm);
	});
});

describe('setTransfer', () => {
	it('records form and concept with a reason', async () => {
		const { db, ru, get } = await setup();
		await saveTerm(db, { languageId: ru, text: 'тоска', status: 'learning1' });
		expect(await setTransfer(db, { languageId: ru, text: 'тоска', form: 'hard', concept: 'hard', reason: ' no  one-word match ' })).toEqual({
			form: 'hard',
			concept: 'hard',
			reason: 'no one-word match'
		});
		expect((await get('тоска')).transfer).toEqual({ form: 'hard', concept: 'hard', reason: 'no one-word match' });
		await expect(setTransfer(db, { languageId: ru, text: 'тоска', form: 'tricky' as 'hard', concept: 'easy' })).rejects.toThrow(InvalidTerm);
		await expect(setTransfer(db, { languageId: ru, text: 'дом', form: 'easy', concept: 'easy' })).rejects.toThrow('is Unknown');
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
