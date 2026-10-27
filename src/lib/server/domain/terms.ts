import { sql, type Kysely, type SelectQueryBuilder, type Transaction } from 'kysely';
import type { Database, SourceValue, StatusValue } from '../db/schema';
import { getLanguage, type Language } from './languages';
import { MAX_TERM_WORDS } from './multiword';
import { parserFor, termKey } from './parsing';
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
	parent?: { id: number; text: string; status: Status };
	followsParent: boolean;
}

/** A Translation as submitted from a form: `id` refers to one the Term already has. */
export interface TranslationInput {
	id?: number;
	text: string;
	/** Who added a new Translation (e.g. picked from the Wiktionary panel); you by default. */
	source?: string;
}

export const SOURCES: readonly Source[] = ['you', 'wiktionary', 'tutor'];

export function isSource(value: string | undefined): value is Source {
	return value !== undefined && (SOURCES as readonly string[]).includes(value);
}

export interface SaveTerm {
	languageId: number;
	text: string;
	status: string;
	/** Omit to keep the current one; a new Chinese Term without one gets pinyin. */
	pronunciation?: string;
	/** Omit to keep the current Translations (e.g. when only the Status changes). */
	translations?: TranslationInput[];
	/** The Parent's text: created if it has no Term yet, '' for none. Omit to keep the current one. */
	parent?: string;
	/** Omit to keep the current choice. Has no effect without a Parent. */
	followsParent?: boolean;
}

export function isStatus(value: string): value is Status {
	return (STATUSES as readonly string[]).includes(value);
}

/**
 * Creates the Term for `text`, or updates the one with the same Normalised form.
 * If given, `translations` replace the Translations, in order. One that keeps an existing
 * Translation's id and text keeps its Source, and an edited one is from you. A new one has the
 * Source it was submitted with, or you.
 */
export async function saveTerm(db: Kysely<Database>, input: SaveTerm): Promise<number> {
	const language = await getLanguage(db, input.languageId);
	if (!language) throw new InvalidTerm('Unknown Language.');
	if (!isStatus(input.status)) throw new InvalidTerm('Choose a Status.');
	const status = input.status;
	const { text, normalised } = termText(input.text, language);
	// undefined keeps the current Parent; null removes it.
	const parent = input.parent === undefined ? undefined : input.parent.trim() === '' ? null : termText(input.parent, language);
	if (parent && parent.normalised === normalised) throw new InvalidTerm("A Term can't be its own Parent.");
	const pronunciation = input.pronunciation?.trim();
	const translations = input.translations
		?.map((t) => ({ ...t, text: t.text.trim() }))
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

		if (parent !== undefined) {
			const parentId = parent === null ? null : await findOrCreate(trx, language, parent, status);
			if (parent && parentId !== null && (await ancestors(trx, parentId)).includes(id)) {
				throw new InvalidTerm(`“${parent.text}” is itself a form of “${text}”.`);
			}
			await trx.updateTable('term').set({ parent_id: parentId }).where('id', '=', id).execute();
		}
		if (input.followsParent !== undefined) {
			await trx.updateTable('term').set({ follows_parent: Number(input.followsParent) }).where('id', '=', id).execute();
		}
		await shareStatus(trx, id, status);

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
						// An existing Translation keeps its Source until you edit it; a new one says where it came from.
						const source = kept ? (kept.text === t.text ? kept.source : 'you') : isSource(t.source) ? t.source : 'you';
						return { term_id: id, position: i + 1, text: t.text, source };
					})
				)
				.execute();
		}
		return id;
	});
}

/** Checks a Term's text and works out its Normalised form; the text is kept lowercased. */
function termText(raw: string, language: Language): { text: string; normalised: string } {
	const text = raw.trim().replace(/\s+/gu, ' ').toLocaleLowerCase(language.code);
	const tokens = parserFor(language)
		.parse(text)
		.flatMap((p) => p.sentences.flatMap((s) => s.tokens));
	const words = tokens.filter((t) => t.isWord).length;
	if (words === 0) throw new InvalidTerm('A Term needs some text.');
	if (tokens.some((t) => !t.isWord && t.text.trim() !== '')) {
		throw new InvalidTerm('A Term can only hold Words and the spaces between them.');
	}
	if (words > MAX_TERM_WORDS) throw new InvalidTerm(`A Term can have at most ${MAX_TERM_WORDS} Words.`);
	return { text, normalised: termKey(text, language) };
}

/** The Term with this Normalised form, created with `status` if there is none (e.g. a new Parent). */
async function findOrCreate(
	trx: Transaction<Database>,
	language: Language,
	term: { text: string; normalised: string },
	status: Status
): Promise<number> {
	const existing = await trx
		.selectFrom('term')
		.select('id')
		.where('language_id', '=', language.id)
		.where('normalised', '=', term.normalised)
		.executeTakeFirst();
	if (existing) return existing.id;
	const created = await trx
		.insertInto('term')
		.values({
			language_id: language.id,
			text: term.text,
			normalised: term.normalised,
			status,
			pronunciation: suggestPronunciation(term.text, language),
			created_at: new Date().toISOString()
		})
		.returning('id')
		.executeTakeFirstOrThrow();
	return created.id;
}

/** A Term's Parent, its Parent's Parent, and so on. */
async function ancestors(trx: Transaction<Database>, id: number): Promise<number[]> {
	const found: number[] = [];
	for (let current: number | null = id; current !== null && !found.includes(current); ) {
		found.push(current);
		const row = await trx.selectFrom('term').select('parent_id').where('id', '=', current).executeTakeFirst();
		current = row?.parent_id ?? null;
	}
	return found;
}

/**
 * Gives `status` to every Term linked to this one through Follows Parent: its Parent if it follows
 * it, the Children that follow it, and so on in both directions.
 */
async function shareStatus(trx: Transaction<Database>, id: number, status: Status): Promise<void> {
	const linked = new Set([id]);
	const queue = [id];
	while (queue.length > 0) {
		const current = queue.pop()!;
		const self = await trx
			.selectFrom('term')
			.select(['parent_id', 'follows_parent'])
			.where('id', '=', current)
			.executeTakeFirstOrThrow();
		const children = await trx
			.selectFrom('term')
			.select('id')
			.where('parent_id', '=', current)
			.where('follows_parent', '=', 1)
			.execute();
		const next = children.map((c) => c.id);
		if (self.follows_parent && self.parent_id !== null) next.push(self.parent_id);
		for (const n of next) {
			if (!linked.has(n)) {
				linked.add(n);
				queue.push(n);
			}
		}
	}
	linked.delete(id);
	if (linked.size > 0) await trx.updateTable('term').set({ status }).where('id', 'in', [...linked]).execute();
}

/**
 * Deleting a Term makes its Words Unknown again (ADR 0001). Its Children lose their Parent and
 * stop following it.
 */
export async function deleteTerm(db: Kysely<Database>, id: number): Promise<void> {
	await db.transaction().execute(async (trx) => {
		await trx.updateTable('term').set({ parent_id: null, follows_parent: 0 }).where('parent_id', '=', id).execute();
		await trx.deleteFrom('term').where('id', '=', id).execute();
	});
}

/** The Terms in a Language for the given Normalised forms, keyed by Normalised form. */
export async function findTerms(
	db: Kysely<Database>,
	languageId: number,
	normalisedForms: string[]
): Promise<Record<string, TermView>> {
	if (normalisedForms.length === 0) return {};
	const rows = await selectTerms(db)
		.where('term.language_id', '=', languageId)
		.where('term.normalised', 'in', [...new Set(normalisedForms)])
		.execute();
	return Object.fromEntries((await toViews(db, rows)).map((t) => [t.normalised, t.view]));
}

/** A Term in the Term list: its view plus its Language and how many Terms have it as Parent. */
export interface TermListItem extends TermView {
	languageId: number;
	children: number;
}

export interface TermFilter {
	languageId?: number;
	/** A Status, or 'learning' for any of Learning 1–4. */
	status?: Status | 'learning';
	/** Only Terms with at least one Translation from this Source. */
	source?: Source;
	/** Text the Term or one of its Translations contains, in any case. */
	search?: string;
	limit?: number;
	offset?: number;
}

export const TERM_PAGE_SIZE = 50;

/** Terms matching a filter, newest first, with how many match in all. */
export async function listTerms(db: Kysely<Database>, filter: TermFilter = {}): Promise<{ terms: TermListItem[]; total: number }> {
	const search = filter.search?.trim().toLocaleLowerCase();
	const filtered = <Q extends SelectQueryBuilder<any, any, any>>(query: Q): Q => {
		let q = query as SelectQueryBuilder<any, any, any>;
		if (filter.languageId !== undefined) q = q.where('term.language_id', '=', filter.languageId);
		if (filter.status === 'learning') q = q.where('term.status', 'in', ['learning1', 'learning2', 'learning3', 'learning4']);
		else if (filter.status !== undefined) q = q.where('term.status', '=', filter.status);
		if (filter.source !== undefined) {
			const source = filter.source;
			q = q.where((eb) =>
				eb.exists(eb.selectFrom('translation').whereRef('translation.term_id', '=', 'term.id').where('translation.source', '=', source).select('translation.id'))
			);
		}
		if (search) {
			const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
			q = q.where((eb) =>
				eb.or([
					eb(sql`lower(term.text)`, 'like', sql`${pattern} escape '\\'`),
					eb('term.normalised', 'like', sql`${pattern} escape '\\'`),
					eb.exists(
						eb
							.selectFrom('translation')
							.whereRef('translation.term_id', '=', 'term.id')
							.where(sql`lower(translation.text)`, 'like', sql`${pattern} escape '\\'`)
							.select('translation.id')
					)
				])
			);
		}
		return q as Q;
	};

	const { total } = await filtered(db.selectFrom('term').select((eb) => eb.fn.countAll<number>().as('total'))).executeTakeFirstOrThrow();
	const rows = await filtered(selectTerms(db))
		.select((eb) => eb.selectFrom('term as child').whereRef('child.parent_id', '=', 'term.id').select(eb.fn.countAll<number>().as('n')).as('children'))
		.orderBy('term.created_at', 'desc')
		.orderBy('term.id', 'desc')
		.limit(filter.limit ?? TERM_PAGE_SIZE)
		.offset(filter.offset ?? 0)
		.execute();
	const views = await toViews(db, rows);
	return {
		total: Number(total),
		terms: views.map(({ view }, i) => ({ ...view, languageId: rows[i].language_id, children: Number(rows[i].children) }))
	};
}

function selectTerms(db: Kysely<Database>) {
	return db
		.selectFrom('term')
		.leftJoin('term as parent', 'parent.id', 'term.parent_id')
		.select([
			'term.id',
			'term.language_id',
			'term.text',
			'term.normalised',
			'term.status',
			'term.pronunciation',
			'term.follows_parent',
			'parent.id as parentId',
			'parent.text as parentText',
			'parent.status as parentStatus'
		]);
}

type TermRow = Awaited<ReturnType<ReturnType<typeof selectTerms>['execute']>>[number];

/** Term rows as views, with their Translations in order. */
async function toViews(db: Kysely<Database>, rows: TermRow[]): Promise<{ normalised: string; view: TermView }[]> {
	if (rows.length === 0) return [];
	const translations = await db
		.selectFrom('translation')
		.select(['id', 'term_id', 'text', 'source'])
		.where(
			'term_id',
			'in',
			rows.map((t) => t.id)
		)
		.orderBy('term_id')
		.orderBy('position')
		.execute();

	return rows.map((t) => ({
		normalised: t.normalised,
		view: {
			id: t.id,
			text: t.text,
			status: t.status,
			pronunciation: t.pronunciation,
			parent:
				t.parentId === null || t.parentText === null || t.parentStatus === null
					? undefined
					: { id: t.parentId, text: t.parentText, status: t.parentStatus },
			followsParent: t.follows_parent === 1,
			translations: translations
				.filter((tr) => tr.term_id === t.id)
				.map((tr) => ({ id: tr.id, text: tr.text, source: tr.source }))
		}
	}));
}
