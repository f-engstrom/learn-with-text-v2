import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { getLanguage } from './languages';
import { termKey } from './parsing';
import { recordReview, type Grade, type PracticeView } from './practice';
import { isLearning, LEVELS } from '../../terms';
import { cleanOrigin, findTerms, InvalidTerm, saveTerm, writeOrigin, type Origin, type OriginInput, type Status, type Transfer } from './terms';

// The Tutor's changes to Terms. The rules live here so no entry point can break them (ADR 0003).

/** Glosses are offered, and saved, only for these: Unknown Words and Learning 1–2 Terms. */
const GLOSSABLE: readonly (Status | 'unknown')[] = ['unknown', 'learning1', 'learning2'];
const TRANSFER_LEVELS = ['easy', 'medium', 'hard'] as const;

export interface Gloss {
	languageId: number;
	/** The Word or phrase as it appears. */
	text: string;
	/** The short meaning the Tutor gave. */
	gloss: string;
}

/**
 * Saves a Gloss as a Translation with Source Tutor, after any the Term already has. An Unknown
 * Word gets a Term at Learning 1. A Translation the Term already has (in any case) isn't added twice.
 */
export async function saveGloss(db: Kysely<Database>, input: Gloss): Promise<{ termId: number; status: Status; added: boolean }> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	const gloss = input.gloss.trim().replace(/\s+/g, ' ');
	if (gloss === '') throw new InvalidTerm('A Gloss needs some text.');
	const key = termKey(input.text, language);
	const term = (await findTerms(db, language.id, [key]))[key];
	const current = term?.status ?? 'unknown';
	if (!GLOSSABLE.includes(current)) {
		throw new InvalidTerm(`“${term?.text}” is ${describe(current)}; Glosses are only for Unknown Words and Learning 1–2 Terms.`);
	}
	const translations = term?.translations ?? [];
	const added = !translations.some((t) => t.text.toLocaleLowerCase() === gloss.toLocaleLowerCase());
	const status = term?.status ?? 'learning1';
	const termId = await saveTerm(db, {
		languageId: language.id,
		text: term?.text ?? input.text,
		status,
		translations: [
			...translations.map((t) => ({ id: t.id, text: t.text, source: t.source })),
			...(added ? [{ text: gloss, source: 'tutor' }] : [])
		]
	});
	return { termId, status, added };
}

/**
 * A Tutor adjustment after the learner answers about a Term: Got it moves the Tutor's assessment one
 * step up, Missed one down, Hard leaves it (ADR 0004). It starts from the learner's Status and never
 * changes it. For a Learning 1–4 Term the answer also counts as a Review.
 */
export async function assessTerm(
	db: Kysely<Database>,
	input: { languageId: number; text: string; answer: string }
): Promise<{ status: Status; from?: Status; to: Status; practice?: PracticeView }> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	if (!['missed', 'hard', 'got'].includes(input.answer)) throw new InvalidTerm('An answer is missed, hard or got.');
	const key = termKey(input.text, language);
	const term = (await findTerms(db, language.id, [key]))[key];
	if (!term) throw new InvalidTerm(`“${input.text}” is Unknown; save a Gloss first to give it a Term.`);
	if (term.status === 'ignored') throw new InvalidTerm(`“${term.text}” is Ignored; it isn't vocabulary to assess.`);
	const from = term.tutorAssessment ?? term.status;
	const step = input.answer === 'got' ? 1 : input.answer === 'missed' ? -1 : 0;
	const to = LEVELS[Math.min(Math.max(LEVELS.indexOf(from) + step, 0), LEVELS.length - 1)];
	// The assessment and the Review it counts as are saved together, or neither is.
	const practice = await db.transaction().execute(async (trx) => {
		await trx.updateTable('term').set({ tutor_level: to }).where('id', '=', term.id).execute();
		return isLearning(term.status) ? recordReview(trx, term.id, input.answer as Grade, 'tutor') : undefined;
	});
	return { status: term.status, ...(term.tutorAssessment ? { from: term.tutorAssessment } : {}), to, ...(practice ? { practice } : {}) };
}

/** Records the Tutor's judgement of how hard a Term is to carry over from Your languages. */
export async function setTransfer(
	db: Kysely<Database>,
	input: { languageId: number; text: string } & Transfer
): Promise<Transfer> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	const valid = (v: string): v is (typeof TRANSFER_LEVELS)[number] => (TRANSFER_LEVELS as readonly string[]).includes(v);
	if (!valid(input.form) || !valid(input.concept)) throw new InvalidTerm('Form and concept are each easy, medium or hard.');
	const key = termKey(input.text, language);
	const term = (await findTerms(db, language.id, [key]))[key];
	if (!term) throw new InvalidTerm(`“${input.text}” is Unknown; save a Gloss first to give it a Term.`);
	const reason = input.reason?.trim().replace(/\s+/g, ' ') || undefined;
	await db
		.updateTable('term')
		.set({ transfer_form: input.form, transfer_concept: input.concept, transfer_reason: reason ?? null })
		.where('id', '=', term.id)
		.execute();
	return { form: input.form, concept: input.concept, ...(reason ? { reason } : {}) };
}

/**
 * Replaces a Term's Origin with the Tutor's, with Source Tutor. Refused for an Unknown Word, for a
 * Term that Follows its Parent (the Origin belongs to the Parent) and for an Origin you wrote.
 */
export async function setOrigin(
	db: Kysely<Database>,
	input: { languageId: number; text: string } & Pick<OriginInput, 'links' | 'note'>
): Promise<Origin> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	const key = termKey(input.text, language);
	const term = (await findTerms(db, language.id, [key]))[key];
	if (!term) throw new InvalidTerm(`“${input.text}” is Unknown; save a Gloss first to give it a Term.`);
	if (term.followsParent && term.parent) {
		throw new InvalidTerm(`“${term.text}” follows its Parent “${term.parent.text}”; set the Origin there.`);
	}
	if (term.origin?.source === 'you') throw new InvalidTerm(`The learner wrote the Origin of “${term.text}” themselves; leave it as it is.`);
	const origin = cleanOrigin(input);
	if (!origin) throw new InvalidTerm('An Origin needs a link or a note.');
	await db.transaction().execute((trx) => writeOrigin(trx, term.id, origin, 'tutor'));
	return { ...origin, source: 'tutor' };
}

/**
 * Links a Term to its Parent, usually its dictionary form (набережной → набережная), creating the
 * Parent at the Term's Status if it has no Term yet. The Term keeps its Status, Translations and
 * Follows Parent choice. A Term that Follows its Parent isn't moved to another one: the two would
 * share a Status, which could change a Term the learner marked Known.
 */
export async function linkParent(
	db: Kysely<Database>,
	input: { languageId: number; text: string; parent: string }
): Promise<{ term: string; parent: string; previousParent?: string; createdParent: boolean }> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	const key = termKey(input.text, language);
	const parentKey = termKey(input.parent, language);
	const found = await findTerms(db, language.id, [key, parentKey]);
	const term = found[key];
	if (!term) throw new InvalidTerm(`“${input.text}” is Unknown; save a Gloss first to give it a Term.`);
	if (term.followsParent && term.parent && term.parent.id !== found[parentKey]?.id) {
		throw new InvalidTerm(`“${term.text}” follows its Parent “${term.parent.text}”; the learner changes that in the Reader.`);
	}
	await saveTerm(db, { languageId: language.id, text: term.text, status: term.status, parent: input.parent });
	const parent = (await findTerms(db, language.id, [parentKey]))[parentKey];
	return {
		term: term.text,
		parent: parent?.text ?? input.parent,
		...(term.parent && term.parent.id !== parent?.id ? { previousParent: term.parent.text } : {}),
		createdParent: !found[parentKey]
	};
}

function describe(status: Status | 'unknown'): string {
	return { unknown: 'Unknown', known: 'Known', ignored: 'Ignored' }[status as string] ?? `at Learning ${status.slice(-1)}`;
}
