import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import type { Language } from './languages';
import { normalise } from './parsing';

/** How common a Word is in its Language (see CONTEXT.md). */
export type FrequencyBand = 'top1k' | 'top5k' | 'top20k' | 'rare';

export const FREQUENCY_BANDS: readonly FrequencyBand[] = ['top1k', 'top5k', 'top20k', 'rare'];

const bandOf = (rank: number | undefined): FrequencyBand =>
	rank === undefined ? 'rare' : rank <= 1000 ? 'top1k' : rank <= 5000 ? 'top5k' : rank <= 20000 ? 'top20k' : 'rare';

/** Where the bundled lists live, relative to where the app and the MCP server run (the project folder). */
let listDirectory = resolve('resources/frequency');

/** For tests: read lists from another folder. */
export function useFrequencyLists(directory: string) {
	listDirectory = directory;
}

/** Languages whose list each database has loaded (or found missing), so the check runs once. */
const checked = new WeakMap<object, Map<number, boolean>>();

/** Loads a Language's bundled list into the database if it isn't there yet. Returns whether it has one. */
async function ensureList(db: Kysely<Database>, language: Language): Promise<boolean> {
	let seen = checked.get(db);
	if (!seen) checked.set(db, (seen = new Map()));
	if (seen.has(language.id)) return seen.get(language.id)!;

	const existing = await db.selectFrom('frequency').select('rank').where('language_id', '=', language.id).limit(1).executeTakeFirst();
	let has = existing !== undefined;
	const file = resolve(listDirectory, `${language.code}.txt`);
	if (!has && existsSync(file)) {
		const ranks = new Map<string, number>();
		for (const line of readFileSync(file, 'utf8').split('\n')) {
			const word = line.trim();
			if (!/\p{L}/u.test(word)) continue;
			const key = normalise(word, language);
			// The first spelling of a Normalised form keeps its rank.
			if (!ranks.has(key)) ranks.set(key, ranks.size + 1);
		}
		const rows = [...ranks].map(([normalised, rank]) => ({ language_id: language.id, normalised, rank }));
		await db.transaction().execute(async (trx) => {
			for (let i = 0; i < rows.length; i += 500) {
				await trx
					.insertInto('frequency')
					.values(rows.slice(i, i + 500))
					.onConflict((oc) => oc.doNothing())
					.execute();
			}
		});
		has = rows.length > 0;
	}
	seen.set(language.id, has);
	return has;
}

/**
 * Frequency bands for Normalised forms of Words in a Language. Phrases (with a space) get none, and
 * neither does a Language without a list.
 */
export async function frequencyBands(db: Kysely<Database>, language: Language, keys: string[]): Promise<Record<string, FrequencyBand>> {
	const words = [...new Set(keys.filter((k) => !/\s/u.test(k)))];
	if (words.length === 0 || !(await ensureList(db, language))) return {};
	const ranks = new Map<string, number>();
	for (let i = 0; i < words.length; i += 500) {
		const rows = await db
			.selectFrom('frequency')
			.select(['normalised', 'rank'])
			.where('language_id', '=', language.id)
			.where('normalised', 'in', words.slice(i, i + 500))
			.execute();
		for (const r of rows) ranks.set(r.normalised, r.rank);
	}
	return Object.fromEntries(words.map((w) => [w, bandOf(ranks.get(w))]));
}

/** Loads every Language's bundled list that isn't loaded yet, e.g. before filtering Terms by Frequency. */
export async function ensureFrequencyLists(db: Kysely<Database>, languages: Language[]): Promise<void> {
	for (const language of languages) await ensureList(db, language);
}

/** The rank range of a band, for filtering in SQL. */
export function bandRanks(band: FrequencyBand): [number, number] {
	return band === 'top1k' ? [1, 1000] : band === 'top5k' ? [1001, 5000] : band === 'top20k' ? [5001, 20000] : [20001, Infinity];
}
