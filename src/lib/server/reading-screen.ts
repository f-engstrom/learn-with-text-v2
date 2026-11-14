// What the reading screen loads, built once for its route and for the stories' fixtures (ADR 0007).
import type { Kysely } from 'kysely';
import type { Database } from './db/schema';
import { isWiktionary } from '../dictionaries';
import { getPage } from './domain/books';
import { listDictionaries } from './domain/dictionaries';
import { fromTutor } from './domain/from-tutor';
import { daySoFar } from './domain/progress';
import { listYourLanguages } from './domain/your-languages';

/**
 * The reading screen's data for Page `position` of a Book, or undefined if there is no such Page.
 * `azureReady` says whether Azure has its key (an env value, so the caller's); `read` adds The day so far,
 * as just after Mark as read.
 */
export async function readingScreenData(
	db: Kysely<Database>,
	bookId: number,
	position: number,
	{ azureReady, read = false }: { azureReady: boolean; read?: boolean }
) {
	const page = await getPage(db, bookId, position);
	if (!page) return undefined;
	const dictionaries = await listDictionaries(db, page.language.id);
	return {
		...page,
		// The Wiktionary page shows in the Wiktionary tab, beneath its suggestions.
		dictionaries: dictionaries.filter((d) => !isWiktionary(d)),
		wiktionaryPage: dictionaries.find(isWiktionary) ?? null,
		// Without its key Azure's tab only says how to set it up, and asks nothing.
		azureReady,
		// Marked where an Origin names one of them.
		yourLanguages: (await listYourLanguages(db)).map((l) => l.name),
		...(await fromTutor(db, page.book.id))!,
		daySoFar: read ? await daySoFar(db, page.language.id) : null
	};
}

export type ReadingScreenData = NonNullable<Awaited<ReturnType<typeof readingScreenData>>>;
