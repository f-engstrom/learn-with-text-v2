import { sql, type Kysely, type SelectQueryBuilder, type Transaction } from 'kysely';
import type { Database, OriginKindValue, OriginSourceValue, SourceValue, StatusValue, TransferValue } from '../db/schema';
import { isOriginKind, isOriginSource, isSource, isStatus, LEARNING } from '../../terms';
import { bandRanks, ensureFrequencyLists, frequencyBands, type FrequencyBand } from './frequency';
import { getLanguage, listLanguages, type Language } from './languages';
import { MAX_TERM_WORDS } from './multiword';
import { practiceViews, type PracticeView } from './practice';
import { parserFor, termKey } from './parsing';
import { suggestPronunciation } from './pronunciation';
import { Refused } from './refused';

export type Status = StatusValue;
export type Source = SourceValue;
export type TransferLevel = TransferValue;
export type OriginKind = OriginKindValue;
export type OriginSource = OriginSourceValue;

/** How hard a Term is to carry over from Your languages (see CONTEXT.md). */
export interface Transfer {
	form: TransferLevel;
	concept: TransferLevel;
	reason?: string;
}

/** One link of an Origin: a loanword from Turkish çorap, a cognate of English water. */
export interface OriginLink {
	kind: OriginKind;
	/** The language named in words, e.g. 'Ottoman Turkish'. */
	language: string;
	/** The word in that language; '' if not known. */
	word: string;
}

/** Where a Term's word comes from, or what it's related to in other languages (see CONTEXT.md). */
export interface Origin {
	/** In order: a chain reads from the nearest source back. */
	links: OriginLink[];
	note?: string;
	source: OriginSource;
	/** The Parent's text, when this is the Parent's Origin shown on a Term that Follows Parent. */
	of?: string;
}

/** An Origin as submitted, with who it came from (you, unless it is unchanged or says otherwise). */
export interface OriginInput {
	links: { kind: string; language: string; word?: string }[];
	note?: string;
	source?: string;
}

/** In display order: Learning 1–4, then Known and Ignored. */
export class InvalidTerm extends Refused {}

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
	/** Learning 1–4 Terms only: when it is Due, and its Recall strength once reviewed. */
	practice?: PracticeView;
	/** For a one-Word Term in a Language with a frequency list. */
	frequency?: FrequencyBand;
	/** The Tutor's assessment, once it has asked about the Term. */
	tutorAssessment?: Status;
	/** Once the Tutor has judged it. */
	transfer?: Transfer;
	/** Its own, or its Parent's when it Follows Parent. */
	origin?: Origin;
}

/** A Translation as submitted from a form: `id` refers to one the Term already has. */
export interface TranslationInput {
	id?: number;
	text: string;
	/** Who added a new Translation (e.g. picked from Wiktionary's suggestions); you by default. */
	source?: string;
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
	/** Omit to keep the current Origin; no links and no note removes it. */
	origin?: OriginInput;
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
	const origin = input.origin === undefined ? undefined : cleanOrigin(input.origin);

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
		if (origin !== undefined) {
			const previous = await readOrigin(trx, id);
			// An unchanged Origin keeps its Source; a changed one is from you unless it says where it came from.
			const source = previous && sameOrigin(previous, origin) ? previous.source : isOriginSource(input.origin?.source) ? input.origin.source : 'you';
			await writeOrigin(trx, id, origin, source);
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

/** Checks an Origin's links and tidies them; null when it has no links and no note. */
export function cleanOrigin(input: OriginInput): Omit<Origin, 'source'> | null {
	const tidy = (v: string | undefined) => (v ?? '').trim().replace(/\s+/gu, ' ');
	const links = input.links
		.map((l) => ({ kind: l.kind, language: tidy(l.language), word: tidy(l.word) }))
		.filter((l) => l.language !== '' || l.word !== '');
	for (const link of links) {
		if (!isOriginKind(link.kind)) throw new InvalidTerm('Each link of an Origin is a loanword, inherited, derived, calque or cognate.');
		if (link.language === '') throw new InvalidTerm(`Name the language “${link.word}” is from.`);
	}
	const note = tidy(input.note);
	if (links.length === 0 && note === '') return null;
	return { links: links as OriginLink[], ...(note ? { note } : {}) };
}

function sameOrigin(a: Omit<Origin, 'source'>, b: Omit<Origin, 'source'> | null): boolean {
	return b !== null && JSON.stringify([a.links, a.note ?? '']) === JSON.stringify([b.links, b.note ?? '']);
}

/** A Term's own Origin, if it has one. */
export async function readOrigin(db: Kysely<Database>, termId: number): Promise<Origin | undefined> {
	const term = await db.selectFrom('term').select(['origin_note', 'origin_source']).where('id', '=', termId).executeTakeFirst();
	if (!term?.origin_source) return undefined;
	const links = await db.selectFrom('origin_link').select(['kind', 'language', 'word']).where('term_id', '=', termId).orderBy('position').execute();
	return { links, ...(term.origin_note ? { note: term.origin_note } : {}), source: term.origin_source };
}

/** Replaces a Term's Origin, or removes it (null). Run it in a transaction. */
export async function writeOrigin(db: Kysely<Database>, termId: number, origin: Omit<Origin, 'source'> | null, source: OriginSource): Promise<void> {
	await db.deleteFrom('origin_link').where('term_id', '=', termId).execute();
	await db
		.updateTable('term')
		.set(origin ? { origin_note: origin.note ?? null, origin_source: source } : { origin_note: null, origin_source: null })
		.where('id', '=', termId)
		.execute();
	if (origin && origin.links.length > 0) {
		await db
			.insertInto('origin_link')
			.values(origin.links.map((l, i) => ({ term_id: termId, position: i + 1, kind: l.kind, language: l.language, word: l.word })))
			.execute();
	}
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
	/** Practised Terms that are Due now (most overdue first), or not Due yet. */
	due?: 'due' | 'later';
	/** Practised Terms by their Recall strength's level, or with no Reviews yet. */
	recall?: Status | 'none';
	/** One-Word Terms in a Frequency band ('rare': not in the top 20,000). */
	frequency?: FrequencyBand;
	limit?: number;
	offset?: number;
}

export const TERM_PAGE_SIZE = 50;

/** Terms matching a filter, newest first, with how many match in all. */
export async function listTerms(db: Kysely<Database>, filter: TermFilter = {}): Promise<{ terms: TermListItem[]; total: number }> {
	const search = filter.search?.trim().toLocaleLowerCase();
	if (filter.frequency) await ensureFrequencyLists(db, await listLanguages(db));
	const filtered = <Q extends SelectQueryBuilder<any, any, any>>(query: Q): Q => {
		let q = query as SelectQueryBuilder<any, any, any>;
		if (filter.languageId !== undefined) q = q.where('term.language_id', '=', filter.languageId);
		if (filter.status === 'learning') q = q.where('term.status', 'in', LEARNING);
		else if (filter.status !== undefined) q = q.where('term.status', '=', filter.status);
		if (filter.source !== undefined) {
			const source = filter.source;
			q = q.where((eb) =>
				eb.exists(eb.selectFrom('translation').whereRef('translation.term_id', '=', 'term.id').where('translation.source', '=', source).select('translation.id'))
			);
		}
		if (filter.frequency) {
			const [low, high] = bandRanks(filter.frequency);
			const ranked = (eb: any) =>
				eb
					.selectFrom('frequency')
					.whereRef('frequency.language_id', '=', 'term.language_id')
					.whereRef('frequency.normalised', '=', 'term.normalised')
					.select('frequency.rank');
			q = q.where('term.normalised', 'not like', '% %');
			q =
				filter.frequency === 'rare'
					? q.where((eb) => eb.not(eb.exists(ranked(eb))))
					: q.where((eb) => eb.exists(ranked(eb).where('frequency.rank', '>=', low).where('frequency.rank', '<=', high)));
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

	const limit = filter.limit ?? TERM_PAGE_SIZE;
	const offset = filter.offset ?? 0;
	const withChildren = <Q extends SelectQueryBuilder<any, any, any>>(q: Q) =>
		q.select((eb) => eb.selectFrom('term as child').whereRef('child.parent_id', '=', 'term.id').select(eb.fn.countAll<number>().as('n')).as('children'));
	const toItems = async (rows: (TermRow & { children: unknown })[]): Promise<TermListItem[]> =>
		(await toViews(db, rows)).map(({ view }, i) => ({ ...view, languageId: rows[i].language_id, children: Number(rows[i].children) }));

	// Due and Recall strength aren't columns, so those filters work on the practice views.
	if (filter.due || filter.recall) {
		const candidates = await filtered(db.selectFrom('term').select(['term.id', 'term.status']))
			.where('term.status', 'in', LEARNING)
			.orderBy('term.created_at', 'desc')
			.orderBy('term.id', 'desc')
			.execute();
		const practice = await practiceViews(db, candidates);
		let matching = candidates.filter((c) => {
			const p = practice.get(c.id);
			if (!p) return false;
			if (filter.due === 'due' && p.overdue === 0) return false;
			if (filter.due === 'later' && p.overdue > 0) return false;
			if (filter.recall === 'none' ? p.recall !== undefined : filter.recall && p.recall?.level !== filter.recall) return false;
			return true;
		});
		if (filter.due === 'due') matching = matching.sort((a, b) => Date.parse(practice.get(a.id)!.due) - Date.parse(practice.get(b.id)!.due));
		const ids = matching.slice(offset, offset + limit).map((c) => c.id);
		const rows = ids.length === 0 ? [] : await withChildren(selectTerms(db)).where('term.id', 'in', ids).execute();
		const byId = new Map((await toItems(rows)).map((item) => [item.id, item]));
		return { total: matching.length, terms: ids.map((id) => byId.get(id)!) };
	}

	const { total } = await filtered(db.selectFrom('term').select((eb) => eb.fn.countAll<number>().as('total'))).executeTakeFirstOrThrow();
	const rows = await withChildren(filtered(selectTerms(db)))
		.orderBy('term.created_at', 'desc')
		.orderBy('term.id', 'desc')
		.limit(limit)
		.offset(offset)
		.execute();
	return { total: Number(total), terms: await toItems(rows) };
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
			'term.tutor_level',
			'term.transfer_form',
			'term.transfer_concept',
			'term.transfer_reason',
			'term.origin_note',
			'term.origin_source',
			'parent.id as parentId',
			'parent.origin_note as parentOriginNote',
			'parent.origin_source as parentOriginSource',
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
	// A Term that Follows Parent shows its Parent's Origin, so the Parents' links are read too.
	const links = await db
		.selectFrom('origin_link')
		.select(['term_id', 'kind', 'language', 'word'])
		.where('term_id', 'in', [...new Set(rows.flatMap((r) => (r.parentId === null ? [r.id] : [r.id, r.parentId])))])
		.orderBy('term_id')
		.orderBy('position')
		.execute();
	const originOf = (id: number, note: string | null, source: OriginSource | null, of?: string): Origin | undefined =>
		source === null
			? undefined
			: {
					links: links.filter((l) => l.term_id === id).map(({ kind, language, word }) => ({ kind, language, word })),
					...(note ? { note } : {}),
					source,
					...(of ? { of } : {})
				};
	const practice = await practiceViews(db, rows);
	const frequency: Record<number, Record<string, FrequencyBand>> = {};
	for (const languageId of new Set(rows.map((r) => r.language_id))) {
		const language = await getLanguage(db, languageId);
		if (language) frequency[languageId] = await frequencyBands(db, language, rows.filter((r) => r.language_id === languageId).map((r) => r.normalised));
	}

	const originFor = (t: TermRow) =>
		t.follows_parent === 1 && t.parentId !== null
			? originOf(t.parentId, t.parentOriginNote, t.parentOriginSource, t.parentText ?? undefined)
			: originOf(t.id, t.origin_note, t.origin_source);

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
			...(practice.has(t.id) ? { practice: practice.get(t.id) } : {}),
			...(frequency[t.language_id]?.[t.normalised] ? { frequency: frequency[t.language_id][t.normalised] } : {}),
			...(t.tutor_level ? { tutorAssessment: t.tutor_level } : {}),
			...(t.transfer_form && t.transfer_concept
				? { transfer: { form: t.transfer_form, concept: t.transfer_concept, ...(t.transfer_reason ? { reason: t.transfer_reason } : {}) } }
				: {}),
			...(originFor(t) ? { origin: originFor(t) } : {}),
			translations: translations
				.filter((tr) => tr.term_id === t.id)
				.map((tr) => ({ id: tr.id, text: tr.text, source: tr.source }))
		}
	}));
}

/** A number that moves on whenever the Language's Terms, Translations or Reviews change, from any process. */
export async function termsVersion(db: Kysely<Database>, languageId: number): Promise<number> {
	const row = await db.selectFrom('language').select('terms_version').where('id', '=', languageId).executeTakeFirst();
	return row?.terms_version ?? 0;
}
