import type { Kysely, Selectable } from 'kysely';
import type { Database, LanguageTable } from '../db/schema';

export interface Language {
	id: number;
	name: string;
	code: string;
	rightToLeft: boolean;
	characterMap: Record<string, string>;
}

export async function listLanguages(db: Kysely<Database>): Promise<Language[]> {
	const rows = await db.selectFrom('language').selectAll().orderBy('name').execute();
	return rows.map(toLanguage);
}

export async function getLanguage(db: Kysely<Database>, id: number): Promise<Language | undefined> {
	const row = await db.selectFrom('language').selectAll().where('id', '=', id).executeTakeFirst();
	return row && toLanguage(row);
}

function toLanguage(row: Selectable<LanguageTable>): Language {
	return {
		id: row.id,
		name: row.name,
		code: row.code,
		rightToLeft: row.right_to_left === 1,
		characterMap: JSON.parse(row.character_map)
	};
}
