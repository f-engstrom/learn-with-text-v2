import { describe, it, expect } from 'vitest';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { listLanguages } from './languages';
import { createBook } from './books';
import { getHighlight, setHighlight } from './reading';
import { saveTerm } from './terms';
import {
	answerTutor,
	askLearner,
	awaitAnswer,
	dismissTutor,
	fromTutor,
	getTutorQuestion,
	InvalidTutorQuestion,
	withdrawQuestion
} from './from-tutor';

async function setup() {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const russian = (await listLanguages(db)).find((l) => l.code === 'ru')!;
	const bookId = await createBook(db, { languageId: russian.id, title: 'Кот', text: 'Кот спит. Мышь бежит.' });
	return { db, bookId, languageId: russian.id };
}

const translate = { prompt: 'Translate «Кот спит».' };
const which = { prompt: 'Which case is «мышь»?', options: ['Nominative', 'Accusative', 'Genitive'] };

describe('Tutor’s question', () => {
	it('is asked with feedback and replaces the one before', async () => {
		const { db, bookId } = await setup();
		await askLearner(db, bookId, { questions: [translate] });
		const asked = await askLearner(db, bookId, { feedback: '✓ Right.', questions: [which, translate] });
		expect(await getTutorQuestion(db, bookId)).toEqual(asked);
		expect(asked).toMatchObject({ feedback: '✓ Right.', questions: [which, translate] });
	});

	it('carries Glosses for the Words in the chunk, short ones only', async () => {
		const { db, bookId } = await setup();
		const glosses = [{ text: 'спит', gloss: 'sleeps (from спать)' }];
		expect((await askLearner(db, bookId, { glosses, questions: [translate] })).glosses).toEqual(glosses);
		expect((await getTutorQuestion(db, bookId))?.glosses).toEqual(glosses);
		await expect(askLearner(db, bookId, { glosses: [{ text: 'спит', gloss: 'x'.repeat(200) }], questions: [translate] })).rejects.toThrow(
			InvalidTutorQuestion
		);
	});

	it('takes one to four questions, each with a prompt and two to four options or none', async () => {
		const { db, bookId } = await setup();
		await expect(askLearner(db, bookId, { questions: [] })).rejects.toThrow(InvalidTutorQuestion);
		await expect(askLearner(db, bookId, { questions: Array(5).fill(translate) })).rejects.toThrow(InvalidTutorQuestion);
		await expect(askLearner(db, bookId, { questions: [{ prompt: ' ' }] })).rejects.toThrow(InvalidTutorQuestion);
		await expect(askLearner(db, bookId, { questions: [{ prompt: 'Pick', options: ['Only'] }] })).rejects.toThrow(InvalidTutorQuestion);
	});

	it('takes an answer to every question, or the learner’s own question instead', async () => {
		const { db, bookId } = await setup();
		const asked = await askLearner(db, bookId, { questions: [which, translate] });
		await expect(answerTutor(db, bookId, asked.askedAt, { answers: ['Nominative'] })).rejects.toThrow(InvalidTutorQuestion);
		await answerTutor(db, bookId, asked.askedAt, { answers: ['Nominative', 'The cat sleeps'] });
		expect((await getTutorQuestion(db, bookId))?.answer).toEqual({ answers: ['Nominative', 'The cat sleeps'] });

		const again = await askLearner(db, bookId, { questions: [translate] });
		await answerTutor(db, bookId, again.askedAt, { ask: 'Why is it спит and not спят?' });
		expect((await getTutorQuestion(db, bookId))?.answer).toEqual({ ask: 'Why is it спит and not спят?' });
	});

	it('refuses an answer to a question that has since been replaced', async () => {
		const { db, bookId } = await setup();
		const old = await askLearner(db, bookId, { questions: [translate] });
		await new Promise((r) => setTimeout(r, 2));
		await askLearner(db, bookId, { questions: [which] });
		await expect(answerTutor(db, bookId, old.askedAt, { answers: ['The cat sleeps'] })).rejects.toThrow(InvalidTutorQuestion);
	});

	it('is dismissed by the learner, with the Highlight, so the reading screen is clear', async () => {
		const { db, bookId } = await setup();
		await setHighlight(db, bookId, { page: 1, first: 1, last: 1, note: 'Look here' });
		await askLearner(db, bookId, { questions: [translate] });
		await dismissTutor(db, bookId);
		expect(await getTutorQuestion(db, bookId)).toBeUndefined();
		expect(await getHighlight(db, bookId)).toBeUndefined();
	});

	it('is withdrawn by the Tutor', async () => {
		const { db, bookId } = await setup();
		await askLearner(db, bookId, { questions: [translate] });
		await withdrawQuestion(db, bookId);
		expect(await getTutorQuestion(db, bookId)).toBeUndefined();
	});
});

describe('From the Tutor', () => {
	it('is the Highlight and the question, either or both', async () => {
		const { db, bookId } = await setup();
		expect(await fromTutor(db, bookId)).toMatchObject({ highlight: null, question: null });
		const highlight = await setHighlight(db, bookId, { page: 1, first: 1, last: 2 });
		const question = await askLearner(db, bookId, { questions: [translate] });
		expect(await fromTutor(db, bookId)).toMatchObject({ highlight, question });
	});

	it('is cleared, both parts, when the learner dismisses it', async () => {
		const { db, bookId } = await setup();
		await setHighlight(db, bookId, { page: 1, first: 1, last: 1 });
		await askLearner(db, bookId, { questions: [translate] });
		await dismissTutor(db, bookId);
		expect(await fromTutor(db, bookId)).toMatchObject({ highlight: null, question: null });
	});

	it('carries a Terms version that moves on when a Term changes', async () => {
		const { db, bookId, languageId } = await setup();
		const before = (await fromTutor(db, bookId))!.termsVersion;
		await saveTerm(db, { languageId, text: 'кот', status: 'learning1', translations: [] });
		expect((await fromTutor(db, bookId))!.termsVersion).not.toBe(before);
	});

	it('is nothing for a Book that does not exist', async () => {
		const { db } = await setup();
		expect(await fromTutor(db, 999)).toBeUndefined();
	});
});

describe('awaitAnswer', () => {
	const quick = { timeoutMs: 300, intervalMs: 10 };

	it('returns the answer once the learner gives it', async () => {
		const { db, bookId } = await setup();
		const asked = await askLearner(db, bookId, { questions: [translate] });
		setTimeout(() => answerTutor(db, bookId, asked.askedAt, { answers: ['The cat sleeps'] }), 30);
		expect(await awaitAnswer(db, bookId, quick)).toEqual({ status: 'answered', answers: ['The cat sleeps'] });
	});

	it('says the learner dismissed it, or is still thinking when time runs out', async () => {
		const { db, bookId } = await setup();
		await askLearner(db, bookId, { questions: [translate] });
		expect(await awaitAnswer(db, bookId, quick)).toEqual({ status: 'waiting' });
		setTimeout(() => dismissTutor(db, bookId), 30);
		expect(await awaitAnswer(db, bookId, quick)).toEqual({ status: 'dismissed' });
	});

	it('says when there is no question to wait for', async () => {
		const { db, bookId } = await setup();
		expect(await awaitAnswer(db, bookId, quick)).toEqual({ status: 'none' });
	});
});
