import { error, fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getPage } from '#lib/server/domain/books.ts';
import { listDictionaries } from '#lib/server/domain/dictionaries.ts';
import { InvalidBookmark, markPageRead, setBookmark } from '#lib/server/domain/reading.ts';
import { deleteTerm, InvalidTerm, saveTerm } from '#lib/server/domain/terms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const page = await getPage(database(), Number(params.bookId), Number(params.position));
	if (!page) error(404, 'Page not found');
	return { ...page, dictionaries: await listDictionaries(database(), page.language.id) };
};

export const actions: Actions = {
	saveTerm: async ({ request }) => {
		const form = await request.formData();
		const ids = form.getAll('translationId').map(String);
		const sources = form.getAll('translationSource').map(String);
		try {
			await saveTerm(database(), {
				languageId: Number(form.get('languageId')),
				text: String(form.get('text') ?? ''),
				status: String(form.get('status') ?? ''),
				pronunciation: String(form.get('pronunciation') ?? ''),
				parent: String(form.get('parent') ?? ''),
				followsParent: form.get('followsParent') === 'on',
				translations: form.getAll('translationText').map((text, i) => ({
					id: ids[i] ? Number(ids[i]) : undefined,
					text: String(text),
					source: sources[i]
				}))
			});
		} catch (e) {
			if (e instanceof InvalidTerm) return fail(400, { message: e.message });
			throw e;
		}
	},
	/** Sets only the Status, creating the Term for an Unknown Word. */
	setStatus: async ({ request }) => {
		const form = await request.formData();
		try {
			await saveTerm(database(), {
				languageId: Number(form.get('languageId')),
				text: String(form.get('text') ?? ''),
				status: String(form.get('status') ?? '')
			});
		} catch (e) {
			if (e instanceof InvalidTerm) return fail(400, { message: e.message });
			throw e;
		}
	},
	deleteTerm: async ({ request }) => {
		const form = await request.formData();
		await deleteTerm(database(), Number(form.get('id')));
	},
	/** Moves the Bookmark to a Sentence on this Page. */
	bookmark: async ({ request, params }) => {
		const form = await request.formData();
		try {
			await setBookmark(database(), Number(params.bookId), {
				page: Number(params.position),
				sentence: Number(form.get('sentence'))
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
