import type { Generated } from 'kysely';

export interface LanguageTable {
	id: Generated<number>;
	name: string;
	/** BCP 47 code, used for segmenting and lowercasing. */
	code: string;
	right_to_left: number;
	/** JSON object mapping characters to their replacement ('' removes them). */
	character_map: string;
	/** The Fit range for Suggestions, as Unknown shares from 0 to 1. */
	fit_min: Generated<number>;
	fit_max: Generated<number>;
}

export interface BookTable {
	id: Generated<number>;
	language_id: number;
	title: string;
	created_at: string;
	/** The Bookmark: 1-based Page position, and 1-based Sentence position on that Page. */
	bookmark_page: Generated<number>;
	bookmark_sentence: Generated<number>;
	/** The Word or phrase last selected in the Bookmark's Sentence, as written; null if none. */
	bookmark_word: string | null;
	/** When the Bookmark last moved; null if it never has. */
	bookmarked_at: string | null;
	/** The Tutor's Highlight: Page position and first and last 1-based Sentence; all null if none. */
	highlight_page: number | null;
	highlight_first: number | null;
	highlight_last: number | null;
	highlight_note: string | null;
	/** When the Highlight was set; null if there is none. */
	highlighted_at: string | null;
	/** The web address a Book came from; null for pasted text and files. */
	url: string | null;
}

export interface PageTable {
	id: Generated<number>;
	book_id: number;
	/** 1-based page number within the Book. */
	position: number;
	text: string;
	/** When the Page was marked Read; null while it isn't. */
	read_at: string | null;
}

export interface SentenceTable {
	id: Generated<number>;
	page_id: number;
	/** 1-based order within the Page. */
	position: number;
	text: string;
}

export type StatusValue = 'learning1' | 'learning2' | 'learning3' | 'learning4' | 'known' | 'ignored';

/** A Language's frequency list, 1 being the most frequent. */
export interface FrequencyTable {
	language_id: number;
	normalised: string;
	rank: number;
}

export type GradeValue = 'missed' | 'hard' | 'got';
export type ReviewSourceValue = 'page' | 'list' | 'tutor';

export interface ReviewTable {
	id: Generated<number>;
	term_id: number;
	grade: GradeValue;
	/** Where the Review happened: practice on a Page, the Term list, or a Tutor question. */
	source: ReviewSourceValue;
	reviewed_at: string;
}

/** A Term's FSRS card (ts-fsrs field names); dates are ISO strings. */
export interface ScheduleTable {
	term_id: number;
	due: string;
	stability: number;
	difficulty: number;
	state: number;
	reps: number;
	lapses: number;
	scheduled_days: number;
	learning_steps: number;
	last_review: string | null;
}

export interface TermTable {
	id: Generated<number>;
	language_id: number;
	/** The Term as you first saved it, for display. */
	text: string;
	/** The Normalised form; unique per Language. */
	normalised: string;
	status: StatusValue;
	/** Optional reading aid, e.g. pinyin; '' when there is none. */
	pronunciation: Generated<string>;
	/** The Term this one is a form of, in the same Language. */
	parent_id: number | null;
	/** 1 when this Term shares its Parent's Status. */
	follows_parent: Generated<number>;
	created_at: string;
}

export type SourceValue = 'you' | 'wiktionary' | 'tutor';

export interface TranslationTable {
	id: Generated<number>;
	term_id: number;
	/** 1-based order within the Term's Translations. */
	position: number;
	text: string;
	source: SourceValue;
}

export type DictionaryDisplay = 'embedded' | 'popup';

export interface DictionaryTable {
	id: Generated<number>;
	language_id: number;
	/** 1-based order of the Language's Dictionaries. */
	position: number;
	name: string;
	/** Address with a `[TERM]` placeholder. */
	url: string;
	/** Shown in a tab next to the Term form, or opened in a popup window for sites that refuse embedding. */
	display: DictionaryDisplay;
}

/** A Book's distinct Words, by Normalised form. */
export interface BookWordTable {
	book_id: number;
	normalised: string;
}

/** A subject you like reading about, in English. */
export interface TopicTable {
	id: Generated<number>;
	text: string;
}

/** A news feed (RSS, RDF or Atom) that Suggestions can come from. */
export interface FeedTable {
	id: Generated<number>;
	language_id: number;
	name: string;
	url: string;
}

export interface Database {
	language: LanguageTable;
	book: BookTable;
	page: PageTable;
	sentence: SentenceTable;
	term: TermTable;
	translation: TranslationTable;
	review: ReviewTable;
	frequency: FrequencyTable;
	schedule: ScheduleTable;
	dictionary: DictionaryTable;
	book_word: BookWordTable;
	topic: TopicTable;
	feed: FeedTable;
}
