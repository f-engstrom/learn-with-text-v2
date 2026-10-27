import type { Kysely } from 'kysely';
import type { Dictionary } from '../../dictionaries';
import type { Database } from '../db/schema';

export type { Dictionary } from '../../dictionaries';

/** A Language's Dictionaries, in order. */
export async function listDictionaries(db: Kysely<Database>, languageId: number): Promise<Dictionary[]> {
	return db
		.selectFrom('dictionary')
		.select(['id', 'name', 'url', 'display'])
		.where('language_id', '=', languageId)
		.orderBy('position')
		.execute();
}
