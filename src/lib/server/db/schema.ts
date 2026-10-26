import type { Generated } from 'kysely';

export interface LanguageTable {
	id: Generated<number>;
	name: string;
	/** BCP 47 code, used for segmenting and lowercasing. */
	code: string;
	right_to_left: number;
	/** JSON object mapping characters to their replacement ('' removes them). */
	character_map: string;
}

export interface Database {
	language: LanguageTable;
}
