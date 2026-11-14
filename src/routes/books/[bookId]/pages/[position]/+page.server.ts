import { AZURE_TRANSLATOR_KEY } from '$app/env/private';
import { error, fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getPage } from '#lib/server/domain/books.ts';
import { isWiktionary } from '#lib/dictionaries.ts';
import { listDictionaries } from '#lib/server/domain/dictionaries.ts';
import { daySoFar } from '#lib/server/domain/progress.ts';
import { InvalidBookmark, markPageRead } from '#lib/server/domain/reading.ts';
import { fromTutor } from '#lib/server/domain/from-tutor.ts';
import { listYourLanguages } from '#lib/server/domain/your-languages.ts';
import { deleteTermAction, saveTermAction } from '#lib/server/term-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const page = await getPage(database(), Number(params.bookId), Number(params.position));
	if (!page) error(404, 'Page not found');
	const dictionaries = await listDictionaries(database(), page.language.id);
	return {
		...page,
		// The Wiktionary page shows in the Wiktionary tab, beneath its suggestions.
		dictionaries: dictionaries.filter((d) => !isWiktionary(d)),
		wiktionaryPage: dictionaries.find(isWiktionary) ?? null,
		// Without its key Azure's tab only says how to set it up, and asks nothing.
		azureReady: !!AZURE_TRANSLATOR_KEY,
		// Marked where an Origin names one of them.
		yourLanguages: (await listYourLanguages(database())).map((l) => l.name),
		...(await fromTutor(database(), page.book.id))!,
		// Just after Mark as read, which sends you here with ?read.
		daySoFar: url.searchParams.has('read') ? await daySoFar(database(), page.language.id) : null
	};
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
