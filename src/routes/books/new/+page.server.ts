import { fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { readAddress } from '#lib/server/domain/addresses.ts';
import { BookExists, createBook } from '#lib/server/domain/books.ts';
import { wikisourceFromWeb } from '#lib/server/domain/classics.ts';
import { getLanguage, listLanguages } from '#lib/server/domain/languages.ts';
import { wikipediaFromWeb } from '#lib/server/domain/suggestions.ts';
import { fetchArticle } from '#lib/server/domain/webpages.ts';
import { Refused } from '#lib/server/domain/refused.ts';
import type { Actions, PageServerLoad } from './$types';

const sources = { wikipedia: wikipediaFromWeb(), wikisource: wikisourceFromWeb() };

export const load: PageServerLoad = async () => {
	return { languages: await listLanguages(database()) };
};

const valuesOf = (form: FormData) => ({
	languageId: Number(form.get('languageId')),
	title: String(form.get('title') ?? ''),
	text: String(form.get('text') ?? ''),
	url: String(form.get('url') ?? '').trim()
});

export const actions: Actions = {
	/**
	 * Reads the text at the web address into the form, to edit before creating the Book: the way the
	 * Tutor would import it once a Language is chosen (a Wikipedia article or a Classic through its API).
	 */
	fetch: async ({ request }) => {
		const values = valuesOf(await request.formData());
		try {
			const language = await getLanguage(database(), values.languageId);
			const article = language ? await readAddress(sources, language, values.url) : await fetchArticle(values.url);
			return { values: { ...values, url: article.url, title: values.title.trim() || article.title, text: article.text }, fetched: true };
		} catch (e) {
			if (e instanceof Refused) return fail(400, { message: e.message, values });
			throw e;
		}
	},
	create: async ({ request }) => {
		const values = valuesOf(await request.formData());
		let id: number;
		try {
			id = await createBook(database(), { ...values, url: values.url || undefined });
		} catch (e) {
			if (e instanceof BookExists) return fail(400, { message: e.message, values, existingId: e.bookId });
			if (e instanceof Refused) return fail(400, { message: e.message, values });
			throw e;
		}
		redirect(303, `/books/${id}/pages/1`);
	}
};
