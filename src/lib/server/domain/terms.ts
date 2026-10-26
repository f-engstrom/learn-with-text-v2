import type { Kysely } from 'kysely';
import type { Database, StatusValue } from '../db/schema';
import { getLanguage } from './languages';
import { normalise } from './parsing';

export type Status = StatusValue;

/** In display order: Learning 1–4, then Known and Ignored. */
export const STATUSES: readonly Status[] = ['learning1', 'learning2', 'learning3', 'learning4', 'known', 'ignored'];

export class InvalidTerm extends Error {}

export interface TermView {
	id: number;
	text: string;
	status: Status;
	/** The first Translation, or '' if there is none. */
	translation: string;
}

export interface SaveTerm {
	languageId: number;
	text: string;
	status: string;
	translation: string;
}

export function isStatus(value: string): value is Status {
	return (STATUSES as readonly string[]).includes(value);
}

/**
 * Creates the Term for `text`, or updates the one with the same Normalised form.
 * For now a Term has at most one Translation, which this replaces.
 */
export async function saveTerm(db: Kysely<Database>, input: SaveTerm): Promise<number> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	if (!isStatus(input.status)) throw new InvalidTerm('Choose a Status.');
	const status = input.status;
	const text = input.text.trim().toLocaleLowerCase(language.code);
	const normalised = normalise(text, language);
	if (normalised === '') throw new InvalidTerm('A Term needs some text.');
	const translation = input.translation.trim();

	return db.transaction().execute(async (trx) => {
		const existing = await trx
			.selectFrom('term')
			.select('id')
			.where('language_id', '=', language.id)
			.where('normalised', '=', normalised)
			.executeTakeFirst();

		const id = existing
			? (await trx.updateTable('term').set({ status }).where('id', '=', existing.id).execute(), existing.id)
			: (
					await trx
						.insertInto('term')
						.values({ language_id: language.id, text, normalised, status, created_at: new Date().toISOString() })
						.returning('id')
						.executeTakeFirstOrThrow()
				).id;

		await trx.deleteFrom('translation').where('term_id', '=', id).execute();
		if (translation !== '') {
			await trx.insertInto('translation').values({ term_id: id, position: 1, text: translation, source: 'you' }).execute();
		}
		return id;
	});
}

/** Deleting a Term makes its Words Unknown again (ADR 0001). */
export async function deleteTerm(db: Kysely<Database>, id: number): Promise<void> {
	await db.deleteFrom('term').where('id', '=', id).execute();
}

/** The Terms in a Language for the given Normalised forms, keyed by Normalised form. */
export async function findTerms(
	db: Kysely<Database>,
	languageId: number,
	normalisedForms: string[]
): Promise<Record<string, TermView>> {
	if (normalisedForms.length === 0) return {};
	const rows = await db
		.selectFrom('term')
		.select(['term.id', 'term.text', 'term.normalised', 'term.status'])
		.select((eb) =>
			eb
				.selectFrom('translation')
				.select('translation.text')
				.whereRef('translation.term_id', '=', 'term.id')
				.orderBy('translation.position')
				.limit(1)
				.as('translation')
		)
		.where('term.language_id', '=', languageId)
		.where('term.normalised', 'in', [...new Set(normalisedForms)])
		.execute();
	return Object.fromEntries(
		rows.map((r) => [r.normalised, { id: r.id, text: r.text, status: r.status, translation: r.translation ?? '' }])
	);
}
