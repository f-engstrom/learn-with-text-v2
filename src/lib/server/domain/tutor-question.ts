import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { clearHighlight } from './reading';

export class InvalidTutorQuestion extends Error {}

/** One thing to answer: typed when it has no options, else a pick among them (or the learner's own words). */
export interface Question {
	prompt: string;
	options?: string[];
}

/** The learner's answer to every question, in order, or their own question to the Tutor instead. */
export type Answer = { answers: string[] } | { ask: string };

/** The Tutor's question in the reading screen (ADR 0006), with feedback on the last answer. One per Book. */
export interface TutorQuestion {
	feedback?: string;
	questions: Question[];
	/** When it was asked; it identifies the question, so a late answer to a replaced one is refused. */
	askedAt: string;
	answer?: Answer;
}

/** What the Tutor hears back while waiting. */
export type Awaited =
	| ({ status: 'answered' } & Answer)
	| { status: 'dismissed' }
	| { status: 'waiting' }
	| { status: 'none' };

export const feedbackLength = 600;
const promptLength = 300;
const optionLength = 120;

/** Asks the learner, replacing any question the Book had (answered, dismissed or not). */
export async function askLearner(
	db: Kysely<Database>,
	bookId: number,
	input: { feedback?: string; questions: Question[] }
): Promise<TutorQuestion> {
	const feedback = input.feedback?.trim() || undefined;
	if (feedback && feedback.length > feedbackLength) throw new InvalidTutorQuestion(`Feedback is at most ${feedbackLength} characters.`);
	if (input.questions.length < 1 || input.questions.length > 4) throw new InvalidTutorQuestion('Ask one to four questions at a time.');
	const questions = input.questions.map(({ prompt, options }) => {
		const p = prompt.trim();
		if (!p || p.length > promptLength) throw new InvalidTutorQuestion(`Each question needs a prompt of at most ${promptLength} characters.`);
		if (!options) return { prompt: p };
		const o = options.map((option) => option.trim());
		if (o.length < 2 || o.length > 4 || o.some((option) => !option || option.length > optionLength)) {
			throw new InvalidTutorQuestion(`A question with options has two to four, each at most ${optionLength} characters; leave them out for a typed answer.`);
		}
		return { prompt: p, options: o };
	});
	const row = {
		feedback: feedback ?? null,
		questions: JSON.stringify(questions),
		asked_at: new Date().toISOString(),
		answer: null,
		answered_at: null,
		dismissed_at: null
	};
	await db
		.insertInto('tutor_question')
		.values({ book_id: bookId, ...row })
		.onConflict((oc) => oc.column('book_id').doUpdateSet(row))
		.execute();
	return { ...(feedback ? { feedback } : {}), questions, askedAt: row.asked_at };
}

/** The Book's question, unless there is none or the learner dismissed it. */
export async function getTutorQuestion(db: Kysely<Database>, bookId: number): Promise<TutorQuestion | undefined> {
	const row = await db.selectFrom('tutor_question').selectAll().where('book_id', '=', bookId).executeTakeFirst();
	if (!row || row.dismissed_at) return undefined;
	return {
		...(row.feedback ? { feedback: row.feedback } : {}),
		questions: JSON.parse(row.questions),
		askedAt: row.asked_at,
		...(row.answer ? { answer: JSON.parse(row.answer) } : {})
	};
}

/** Records the learner's answer to the question asked at `askedAt`; they may change it until the Tutor asks again. */
export async function answerTutor(db: Kysely<Database>, bookId: number, askedAt: string, answer: Answer): Promise<void> {
	const question = await getTutorQuestion(db, bookId);
	if (!question || question.askedAt !== askedAt) throw new InvalidTutorQuestion('The Tutor has moved on from that question.');
	let clean: Answer;
	if ('ask' in answer) {
		const ask = answer.ask.trim();
		if (!ask) throw new InvalidTutorQuestion('Write your question for the Tutor.');
		clean = { ask };
	} else {
		const answers = answer.answers.map((a) => a.trim());
		if (answers.length !== question.questions.length || answers.some((a) => !a)) {
			throw new InvalidTutorQuestion('Answer every question, or ask the Tutor something instead.');
		}
		clean = { answers };
	}
	await db
		.updateTable('tutor_question')
		.set({ answer: JSON.stringify(clean), answered_at: new Date().toISOString() })
		.where('book_id', '=', bookId)
		.execute();
}

/** The learner puts the Tutor aside: the question and the Highlight leave the reading screen. */
export async function dismissTutor(db: Kysely<Database>, bookId: number): Promise<void> {
	await db.updateTable('tutor_question').set({ dismissed_at: new Date().toISOString() }).where('book_id', '=', bookId).execute();
	await clearHighlight(db, bookId);
}

/** The Tutor takes its question back, e.g. when the session stops. */
export async function withdrawQuestion(db: Kysely<Database>, bookId: number): Promise<void> {
	await db.deleteFrom('tutor_question').where('book_id', '=', bookId).execute();
}

/**
 * Waits for the learner to answer the Book's question or dismiss it, checking every `intervalMs`.
 * After `timeoutMs` it says they are still thinking, so the Tutor can wait again.
 */
export async function awaitAnswer(
	db: Kysely<Database>,
	bookId: number,
	{ timeoutMs, intervalMs = 500 }: { timeoutMs: number; intervalMs?: number }
): Promise<Awaited> {
	const until = Date.now() + timeoutMs;
	for (;;) {
		const row = await db.selectFrom('tutor_question').select(['answer', 'dismissed_at']).where('book_id', '=', bookId).executeTakeFirst();
		if (!row) return { status: 'none' };
		if (row.dismissed_at) return { status: 'dismissed' };
		if (row.answer) return { status: 'answered', ...JSON.parse(row.answer) };
		if (Date.now() >= until) return { status: 'waiting' };
		await new Promise((r) => setTimeout(r, intervalMs));
	}
}
