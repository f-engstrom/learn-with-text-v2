import { error, fail } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getPage } from '#lib/server/domain/books.ts';
import { deleteTerm, InvalidTerm, saveTerm } from '#lib/server/domain/terms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const page = await getPage(database(), Number(params.bookId), Number(params.position));
	if (!page) error(404, 'Page not found');
	return page;
};

export const actions: Actions = {
	saveTerm: async ({ request }) => {
		const form = await request.formData();
		try {
			await saveTerm(database(), {
				languageId: Number(form.get('languageId')),
				text: String(form.get('text') ?? ''),
				status: String(form.get('status') ?? ''),
				translation: String(form.get('translation') ?? '')
			});
		} catch (e) {
			if (e instanceof InvalidTerm) return fail(400, { message: e.message });
			throw e;
		}
	},
	deleteTerm: async ({ request }) => {
		const form = await request.formData();
		await deleteTerm(database(), Number(form.get('id')));
	}
};
