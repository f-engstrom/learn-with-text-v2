import { error, fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getPage } from '#lib/server/domain/books.ts';
import { listDictionaries } from '#lib/server/domain/dictionaries.ts';
import { InvalidBookmark, markPageRead, setBookmark } from '#lib/server/domain/reading.ts';
import { deleteTermAction, saveTermAction, setStatusAction } from '#lib/server/term-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const page = await getPage(database(), Number(params.bookId), Number(params.position));
	if (!page) error(404, 'Page not found');
	return { ...page, dictionaries: await listDictionaries(database(), page.language.id) };
};

export const actions: Actions = {
	saveTerm: saveTermAction,
	setStatus: setStatusAction,
	deleteTerm: deleteTermAction,
	/** Moves the Bookmark to a Sentence on this Page. */
	bookmark: async ({ request, params }) => {
		const form = await request.formData();
		try {
			await setBookmark(database(), Number(params.bookId), {
				page: Number(params.position),
				sentence: Number(form.get('sentence')),
				word: String(form.get('word') ?? '') || undefined
			});
		} catch (e) {
			if (e instanceof InvalidBookmark) return fail(400, { message: e.message });
			throw e;
		}
	},
	/** Marks this Page Read (optionally making the rest Known) and goes on to the next Page. */
	markRead: async ({ request, params }) => {
		const form = await request.formData();
		let next: number | undefined;
		try {
			next = await markPageRead(database(), Number(params.bookId), Number(params.position), {
				restKnown: form.get('restKnown') === 'true'
			});
		} catch (e) {
			if (e instanceof InvalidBookmark) return fail(400, { message: e.message });
			throw e;
		}
		if (next !== undefined) redirect(303, `/books/${params.bookId}/pages/${next}`);
	}
};
