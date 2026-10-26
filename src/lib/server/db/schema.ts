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

export interface BookTable {
	id: Generated<number>;
	language_id: number;
	title: string;
	created_at: string;
}

export interface PageTable {
	id: Generated<number>;
	book_id: number;
	/** 1-based page number within the Book. */
	position: number;
	text: string;
}

export interface SentenceTable {
	id: Generated<number>;
	page_id: number;
	/** 1-based order within the Page. */
	position: number;
	text: string;
}

export interface Database {
	language: LanguageTable;
	book: BookTable;
	page: PageTable;
	sentence: SentenceTable;
}
