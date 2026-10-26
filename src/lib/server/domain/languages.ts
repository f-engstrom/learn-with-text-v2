import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

export interface Language {
	id: number;
	name: string;
	code: string;
	rightToLeft: boolean;
	characterMap: Record<string, string>;
}

export async function listLanguages(db: Kysely<Database>): Promise<Language[]> {
	const rows = await db.selectFrom('language').selectAll().orderBy('name').execute();
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		code: row.code,
		rightToLeft: row.right_to_left === 1,
		characterMap: JSON.parse(row.character_map)
	}));
}
