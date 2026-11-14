import { AZURE_TRANSLATOR_KEY } from '$app/env/private';
import { error, fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getPage } from '#lib/server/domain/books.ts';
import { daySoFar } from '#lib/server/domain/progress.ts';
import { InvalidBookmark, markPageRead } from '#lib/server/domain/reading.ts';
import { readingScreenData } from '#lib/server/reading-screen.ts';
import { deleteTermAction, saveTermAction } from '#lib/server/term-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const screen = await readingScreenData(database(), Number(params.bookId), Number(params.position), {
		azureReady: !!AZURE_TRANSLATOR_KEY,
		// Just after Mark as read, which sends you here with ?read.
		read: url.searchParams.has('read')
	});
	if (!screen) error(404, 'Page not found');
	return screen;
};

export const actions: Actions = {
	saveTerm: saveTermAction,
	deleteTerm: deleteTermAction,
	/** Marks this Page Read (optionally making the rest Known) and goes on to the next Page, showing the day so far. */
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
		if (next !== undefined) redirect(303, `/books/${params.bookId}/pages/${next}?read`);
		const page = await getPage(database(), Number(params.bookId), Number(params.position));
		return { daySoFar: await daySoFar(database(), page!.language.id) };
	}
};
