import type { Kysely } from 'kysely';
import type { Database, SourceValue, StatusValue } from '../db/schema';
import { getLanguage } from './languages';
import { normalise } from './parsing';
import { suggestPronunciation } from './pronunciation';

export type Status = StatusValue;
export type Source = SourceValue;

/** In display order: Learning 1–4, then Known and Ignored. */
export const STATUSES: readonly Status[] = ['learning1', 'learning2', 'learning3', 'learning4', 'known', 'ignored'];

export class InvalidTerm extends Error {}

export interface TranslationView {
	id: number;
	text: string;
	source: Source;
}

export interface TermView {
	id: number;
	text: string;
	status: Status;
	pronunciation: string;
	/** In order; the first is the main meaning. */
	translations: TranslationView[];
}

/** A Translation as submitted from a form: `id` refers to one the Term already has. */
export interface TranslationInput {
	id?: number;
	text: string;
}

export interface SaveTerm {
	languageId: number;
	text: string;
	status: string;
	/** Omit to keep the current one; a new Chinese Term without one gets pinyin. */
	pronunciation?: string;
	/** Omit to keep the current Translations (e.g. when only the Status changes). */
	translations?: TranslationInput[];
}

export function isStatus(value: string): value is Status {
	return (STATUSES as readonly string[]).includes(value);
}

/**
 * Creates the Term for `text`, or updates the one with the same Normalised form.
 * If given, `translations` replace the Translations, in order. One that keeps an existing
 * Translation's id and text keeps its Source; anything new or edited is from you.
 */
export async function saveTerm(db: Kysely<Database>, input: SaveTerm): Promise<number> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	if (!isStatus(input.status)) throw new InvalidTerm('Choose a Status.');
	const status = input.status;
	const text = input.text.trim().toLocaleLowerCase(language.code);
	const normalised = normalise(text, language);
	if (normalised === '') throw new InvalidTerm('A Term needs some text.');
	const pronunciation = input.pronunciation?.trim();
	const translations = input.translations
		?.map((t) => ({ id: t.id, text: t.text.trim() }))
		.filter((t) => t.text !== '');

	return db.transaction().execute(async (trx) => {
		const existing = await trx
			.selectFrom('term')
			.select('id')
			.where('language_id', '=', language.id)
			.where('normalised', '=', normalised)
			.executeTakeFirst();

		let id: number;
		if (existing) {
			id = existing.id;
			await trx
				.updateTable('term')
				.set(pronunciation === undefined ? { status } : { status, pronunciation })
				.where('id', '=', id)
				.execute();
		} else {
			({ id } = await trx
				.insertInto('term')
				.values({
					language_id: language.id,
					text,
					normalised,
					status,
					pronunciation: pronunciation || suggestPronunciation(text, language),
					created_at: new Date().toISOString()
				})
				.returning('id')
				.executeTakeFirstOrThrow());
		}

		if (translations === undefined) return id;

		const previous = new Map(
			(await trx.selectFrom('translation').select(['id', 'text', 'source']).where('term_id', '=', id).execute()).map(
				(t) => [t.id, t]
			)
		);
		await trx.deleteFrom('translation').where('term_id', '=', id).execute();
		if (translations.length > 0) {
			await trx
				.insertInto('translation')
				.values(
					translations.map((t, i) => {
						const kept = t.id === undefined ? undefined : previous.get(t.id);
						return {
							term_id: id,
							position: i + 1,
							text: t.text,
							source: kept && kept.text === t.text ? kept.source : 'you'
						};
					})
				)
				.execute();
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
	const terms = await db
		.selectFrom('term')
		.select(['id', 'text', 'normalised', 'status', 'pronunciation'])
		.where('language_id', '=', languageId)
		.where('normalised', 'in', [...new Set(normalisedForms)])
		.execute();
	if (terms.length === 0) return {};

	const translations = await db
		.selectFrom('translation')
		.select(['id', 'term_id', 'text', 'source'])
		.where(
			'term_id',
			'in',
			terms.map((t) => t.id)
		)
		.orderBy('term_id')
		.orderBy('position')
		.execute();

	return Object.fromEntries(
		terms.map((t) => [
			t.normalised,
			{
				id: t.id,
				text: t.text,
				status: t.status,
				pronunciation: t.pronunciation,
				translations: translations
					.filter((tr) => tr.term_id === t.id)
					.map((tr) => ({ id: tr.id, text: tr.text, source: tr.source }))
			}
		])
	);
}
