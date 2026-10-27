import { error, fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { InvalidBook } from '#lib/server/domain/books.ts';
import { getLanguage } from '#lib/server/domain/languages.ts';
import { findSuggestions, getFitRange, importArticle, setFitRange, wikipediaFromWeb } from '#lib/server/domain/suggestions.ts';
import { listTopics } from '#lib/server/domain/topics.ts';
import type { Suggestion } from '#lib/suggestions.ts';
import type { Actions, PageServerLoad } from './$types';

// One per server, so an article you pick is already in its memory.
const wikipedia = wikipediaFromWeb();

export const load: PageServerLoad = async ({ params }) => {
	const db = database();
	const language = await getLanguage(db, Number(params.languageId));
	if (!language) error(404, 'Language not found');
	// Streamed: the page shows at once and the Suggestions arrive when Wikipedia has answered.
	const suggestions = findSuggestions(db, wikipedia, language).then(
		(found) => ({ found: found.map(({ text, ...suggestion }): Suggestion => suggestion) }),
		(e) => {
			console.error('Finding Suggestions failed', e);
			return { failed: "Couldn't reach Wikipedia. Try again in a moment." };
		}
	);
	return { language, fitRange: await getFitRange(db, language.id), topics: await listTopics(db), suggestions };
};

export const actions: Actions = {
	fitRange: async ({ request, params }) => {
		const form = await request.formData();
		const range = await setFitRange(database(), Number(params.languageId), {
			min: Number(form.get('min')) / 100,
			max: Number(form.get('max')) / 100
		});
		return { fitRange: range };
	},
	pick: async ({ request, params }) => {
		const db = database();
		const language = await getLanguage(db, Number(params.languageId));
		if (!language) error(404, 'Language not found');
		const form = await request.formData();
		let id: number | undefined;
		try {
			id = await importArticle(db, wikipedia, language, String(form.get('title') ?? ''));
		} catch (e) {
			if (e instanceof InvalidBook) return fail(400, { message: e.message });
			console.error('Importing an article failed', e);
			return fail(502, { message: "Couldn't fetch the article from Wikipedia." });
		}
		if (id === undefined) return fail(404, { message: 'Wikipedia no longer has that article.' });
		redirect(303, `/books/${id}`);
	}
};
