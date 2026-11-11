/**
 * The stories' fixtures: what each route's load returns, built by the domain (world.ts) and kept in
 * fixtures.json. Shared with the browser, so only types come from lib/server.
 */
import type { Dictionary } from '#lib/dictionaries.ts';
import type { BookSummary, Bookmark, PageView } from '#lib/server/domain/books.ts';
import type { Feed } from '#lib/server/domain/feeds.ts';
import type { FromTutor } from '#lib/server/domain/from-tutor.ts';
import type { Language } from '#lib/server/domain/languages.ts';
import type { Example } from '#lib/server/domain/practice.ts';
import type { DaySoFar, LanguageProgress } from '#lib/server/domain/progress.ts';
import type { TermListItem } from '#lib/server/domain/terms.ts';
import type { Topic } from '#lib/server/domain/topics.ts';
import type { YourLanguage } from '#lib/server/domain/your-languages.ts';
import type { FitRange } from '#lib/suggestions.ts';
import json from './fixtures.json';

/** The reading screen's data. */
export type ReadingData = PageView & { dictionaries: Dictionary[] } & FromTutor & { daySoFar: DaySoFar | null };

/** Every other route's data. */
export interface RouteData {
	home: {
		languages: Language[];
		books: BookSummary[];
		latest?: { bookId: number; title: string; bookmark: Bookmark; at: string };
		due: number;
	};
	terms: {
		languages: Language[];
		filter: Record<'language' | 'status' | 'source' | 'q' | 'due' | 'recall' | 'frequency', string | number>;
		terms: TermListItem[];
		total: number;
		page: number;
		pageSize: number;
	};
	review: {
		languages: Language[];
		languageId: number | '';
		remaining: number;
		term?: TermListItem & { language: Language };
		example?: Example;
	};
	progress: { languages: LanguageProgress[] };
	feeds: { languages: Language[]; feeds: Feed[] };
	you: { languages: YourLanguage[] };
	topics: { topics: Topic[] };
	newBook: { languages: Language[] };
	suggestions: { language: Language; fitRange: FitRange; topics: Topic[]; feeds: Feed[]; classics: number };
}

export interface Fixtures {
	/** The moment the fixtures were read at; the stories' clock is set to it. */
	now: string;
	reading: Record<'fresh' | 'mixed' | 'lastPage' | 'rightToLeft' | 'characters' | 'afterRead', ReadingData>;
	/** From the Tutor on the first Page of `reading.mixed`, a step at a time. */
	tutor: Record<'highlight' | 'passage' | 'question' | 'answered', FromTutor>;
	/** A Reader some weeks in. */
	routes: RouteData;
	/** A Reader nobody has used yet. */
	emptyRoutes: RouteData;
}

export const fixtures = json as unknown as Fixtures;

/** A copy to change in one story without touching the others'. */
export const copy = <T>(value: T): T => structuredClone(value);
