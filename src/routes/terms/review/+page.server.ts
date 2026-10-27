import { database } from '#lib/server/database.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import { findExample } from '#lib/server/domain/practice.ts';
import { listTerms } from '#lib/server/domain/terms.ts';
import { reviewAction } from '#lib/server/term-actions.ts';
import type { Actions, PageServerLoad } from './$types';

/** The review in the Term list: the most overdue Due Term (in one Language, if chosen), with a Sentence it appears in. */
export const load: PageServerLoad = async ({ url }) => {
	const db = database();
	const languageId = Number(url.searchParams.get('language')) || undefined;
	const { terms, total } = await listTerms(db, { languageId, due: 'due', limit: 1 });
	const languages = await listLanguages(db);
	const term = terms[0];
	return {
		languages,
		languageId: languageId ?? '',
		remaining: total,
		term: term && { ...term, language: languages.find((l) => l.id === term.languageId)! },
		example: term && (await findExample(db, term.id))
	};
};

export const actions: Actions = { review: reviewAction };
