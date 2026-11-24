import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { clearHighlight, getHighlight, type Highlight } from './reading';
import { termsVersion } from './terms';
import { Refused } from './refused';
import { gapMark } from '../../question-kinds';

export class InvalidTutorQuestion extends Refused {}

/**
 * One thing to answer. Without a kind it is typed when it has no options, else a pick among them (or the learner's
 * own words). With one, the learner puts words in order, fills the gaps in a sentence, or matches words with meanings;
 * the screen shuffles what it shows, and the answer is still one line of text (see `lib/question-kinds.ts`).
 */
export type Question =
	| { prompt: string; options?: string[] }
	/** `words` in the order that is right; the screen shuffles them. */
	| { prompt: string; kind: 'order'; words: string[] }
	/** `text` with a `___` for each gap; `bank` the words to fill them from, else they are typed. */
	| { prompt: string; kind: 'gaps'; text: string; bank?: string[] }
	/** `right[i]` is `left[i]`'s match; the screen shuffles the right. */
	| { prompt: string; kind: 'match'; left: string[]; right: string[] };

export type QuestionKind = Extract<Question, { kind: string }>['kind'];
export const questionKinds = ['order', 'gaps', 'match'] as const satisfies readonly QuestionKind[];

/** A question as the Tutor sends it: one flat shape, whose kind says which fields it uses. */
export interface QuestionInput {
	prompt: string;
	options?: string[];
	kind?: QuestionKind;
	words?: string[];
	text?: string;
	bank?: string[];
	left?: string[];
	right?: string[];
}

/** A short meaning for a Word or phrase in the chunk, shown with the question (and saved with save_gloss). */
export interface QuestionGloss {
	text: string;
	gloss: string;
}

/** The learner's answer to every question, in order, or their own question to the Tutor instead. */
export type Answer = { answers: string[] } | { ask: string };

/** The Tutor's question in the reading screen (ADR 0006), with feedback on the last answer. One per Book. */
export interface TutorQuestion {
	feedback?: string;
	glosses?: QuestionGloss[];
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
const glossLength = 120;
const wordLength = 60;

/** Asks the learner, replacing any question the Book had (answered, dismissed or not). */
export async function askLearner(
	db: Kysely<Database>,
	bookId: number,
	input: { feedback?: string; glosses?: QuestionGloss[]; questions: QuestionInput[] }
): Promise<TutorQuestion> {
	const feedback = input.feedback?.trim() || undefined;
	if (feedback && feedback.length > feedbackLength) throw new InvalidTutorQuestion(`Feedback is at most ${feedbackLength} characters.`);
	const glosses = (input.glosses ?? []).map(({ text, gloss }) => {
		const g = { text: text.trim(), gloss: gloss.trim() };
		if (!g.text || !g.gloss || g.text.length > glossLength || g.gloss.length > glossLength) {
			throw new InvalidTutorQuestion(`Each Gloss is a Word or phrase and a short meaning, each at most ${glossLength} characters.`);
		}
		return g;
	});
	if (glosses.length > 12) throw new InvalidTutorQuestion('Give at most 12 Glosses with a question.');
	if (input.questions.length < 1 || input.questions.length > 4) throw new InvalidTutorQuestion('Ask one to four questions at a time.');
	const questions = input.questions.map(toQuestion);
	const row = {
		feedback: feedback ?? null,
		glosses: glosses.length ? JSON.stringify(glosses) : null,
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
	return { ...(feedback ? { feedback } : {}), ...(glosses.length ? { glosses } : {}), questions, askedAt: row.asked_at };
}

/** A list of short items, trimmed, `min` to `max` of them, each different; else the rule broken. */
function items(list: string[] | undefined, min: number, max: number, rule: string): string[] {
	const trimmed = (list ?? []).map((item) => item.trim());
	if (trimmed.length < min || trimmed.length > max || trimmed.some((item) => !item || item.length > wordLength)) {
		throw new InvalidTutorQuestion(rule);
	}
	if (new Set(trimmed).size !== trimmed.length) throw new InvalidTutorQuestion(`${rule} No two the same.`);
	return trimmed;
}

/** Checks one question as the Tutor sent it and keeps only the fields its kind uses. */
function toQuestion(input: QuestionInput): Question {
	const prompt = input.prompt.trim();
	if (!prompt || prompt.length > promptLength) throw new InvalidTutorQuestion(`Each question needs a prompt of at most ${promptLength} characters.`);
	const others = (['options', 'words', 'text', 'bank', 'left', 'right'] as const).filter((field) => input[field] !== undefined);
	const only = (...fields: string[]) => {
		const extra = others.filter((field) => !fields.includes(field));
		if (extra.length) throw new InvalidTutorQuestion(`A ${input.kind ?? 'typed or picked'} question doesn’t take ${extra.join(' or ')}.`);
	};
	switch (input.kind) {
		case undefined: {
			only('options');
			if (!input.options) return { prompt };
			const options = input.options.map((option) => option.trim());
			if (options.length < 2 || options.length > 4 || options.some((option) => !option || option.length > optionLength)) {
				throw new InvalidTutorQuestion(`A question with options has two to four, each at most ${optionLength} characters; leave them out for a typed answer.`);
			}
			return { prompt, options };
		}
		case 'order': {
			only('words');
			const words = (input.words ?? []).map((w) => w.trim());
			if (words.length < 3 || words.length > 12 || words.some((w) => !w || w.length > wordLength)) {
				throw new InvalidTutorQuestion(`An order question has three to twelve words, each at most ${wordLength} characters, in the order that is right.`);
			}
			return { prompt, kind: 'order', words };
		}
		case 'gaps': {
			only('text', 'bank');
			const text = (input.text ?? '').trim();
			const gaps = text.split(gapMark).length - 1;
			if (gaps < 1 || gaps > 4 || text.length > promptLength) {
				throw new InvalidTutorQuestion(`A gaps question has a text of at most ${promptLength} characters with one to four gaps, each written ${gapMark}.`);
			}
			if (input.bank === undefined) return { prompt, kind: 'gaps', text };
			const bank = items(input.bank, Math.max(gaps, 2), 8, `A bank has a word for each gap and may add others, two to eight in all, each at most ${wordLength} characters.`);
			return { prompt, kind: 'gaps', text, bank };
		}
		case 'match': {
			only('left', 'right');
			const rule = `A match question has two to six on the left and as many on the right, right[i] matching left[i], each at most ${wordLength} characters.`;
			const left = items(input.left, 2, 6, rule);
			const right = items(input.right, left.length, left.length, rule);
			return { prompt, kind: 'match', left, right };
		}
		default:
			throw new InvalidTutorQuestion(`A question’s kind is one of ${questionKinds.join(', ')}, or none.`);
	}
}

/** The Book's question, unless there is none or the learner dismissed it. */
export async function getTutorQuestion(db: Kysely<Database>, bookId: number): Promise<TutorQuestion | undefined> {
	const row = await db.selectFrom('tutor_question').selectAll().where('book_id', '=', bookId).executeTakeFirst();
	if (!row || row.dismissed_at) return undefined;
	return {
		...(row.feedback ? { feedback: row.feedback } : {}),
		...(row.glosses ? { glosses: JSON.parse(row.glosses) } : {}),
		questions: JSON.parse(row.questions),
		askedAt: row.asked_at,
		...(row.answer ? { answer: JSON.parse(row.answer) } : {})
	};
}

/** From the Tutor: what the reading screen shows for a Book, and its Language's Terms version so the screen can follow Term changes. */
export interface FromTutor {
	highlight: Highlight | null;
	question: TutorQuestion | null;
	termsVersion: number;
}

/** From the Tutor for a Book, or undefined if there is no such Book. */
export async function fromTutor(db: Kysely<Database>, bookId: number): Promise<FromTutor | undefined> {
	const book = await db.selectFrom('book').select('language_id').where('id', '=', bookId).executeTakeFirst();
	if (!book) return undefined;
	return {
		highlight: (await getHighlight(db, bookId)) ?? null,
		question: (await getTutorQuestion(db, bookId)) ?? null,
		termsVersion: await termsVersion(db, book.language_id)
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
