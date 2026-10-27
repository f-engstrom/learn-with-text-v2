import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { getLanguage } from './languages';
import { termKey } from './parsing';
import { findTerms, InvalidTerm, saveTerm, type Status } from './terms';

// The Tutor's changes to Terms. The rules live here so no entry point can break them (ADR 0003).

/** Glosses are offered, and saved, only for these: Unknown Words and Learning 1–2 Terms. */
const GLOSSABLE: readonly (Status | 'unknown')[] = ['unknown', 'learning1', 'learning2'];
const LEARNING: readonly Status[] = ['learning1', 'learning2', 'learning3', 'learning4'];

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
 * A Tutor adjustment: one Learning step up after a right answer, one down after a miss. It only
 * applies to Learning 1–4 Terms and never leaves that range; only you set Known or Ignored.
 */
export async function adjustLearning(
	db: Kysely<Database>,
	input: { languageId: number; text: string; direction: 'up' | 'down' }
): Promise<{ from: Status; to: Status }> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	const key = termKey(input.text, language);
	const term = (await findTerms(db, language.id, [key]))[key];
	if (!term) throw new InvalidTerm(`“${input.text}” is Unknown; save a Gloss first to give it a Term.`);
	const level = LEARNING.indexOf(term.status);
	if (level === -1) throw new InvalidTerm(`“${term.text}” is ${describe(term.status)}; the Tutor only adjusts Learning 1–4.`);
	const to = LEARNING[Math.min(Math.max(level + (input.direction === 'up' ? 1 : -1), 0), LEARNING.length - 1)];
	// Through saveTerm, so a Term that Follows its Parent moves with it.
	if (to !== term.status) await saveTerm(db, { languageId: language.id, text: term.text, status: to });
	return { from: term.status, to };
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
