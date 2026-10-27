import { database } from '#lib/server/database.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import { isSource, isStatus, listTerms, TERM_PAGE_SIZE, type TermFilter } from '#lib/server/domain/terms.ts';
import { deleteTermAction, reviewAction, saveTermAction, setStatusAction } from '#lib/server/term-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const db = database();
	const param = (name: string) => url.searchParams.get(name) ?? '';
	const languageId = Number(param('language')) || undefined;
	const status = param('status');
	const source = param('source');
	const due = param('due');
	const recall = param('recall');
	const page = Math.max(1, Math.trunc(Number(param('page'))) || 1);
	const filter: TermFilter = {
		languageId,
		status: status === 'learning' || isStatus(status) ? status : undefined,
		source: isSource(source) ? source : undefined,
		search: param('q') || undefined,
		due: due === 'due' || due === 'later' ? due : undefined,
		recall: recall === 'none' || isStatus(recall) ? recall : undefined,
		limit: TERM_PAGE_SIZE,
		offset: (page - 1) * TERM_PAGE_SIZE
	};
	const { terms, total } = await listTerms(db, filter);
	return {
		languages: await listLanguages(db),
		filter: {
			language: languageId ?? '',
			status: filter.status ?? '',
			source: filter.source ?? '',
			q: filter.search ?? '',
			due: filter.due ?? '',
			recall: filter.recall ?? ''
		},
		terms,
		total,
		page,
		pageSize: TERM_PAGE_SIZE
	};
};

export const actions: Actions = {
	saveTerm: saveTermAction,
	setStatus: setStatusAction,
	deleteTerm: deleteTermAction,
	review: reviewAction
};
