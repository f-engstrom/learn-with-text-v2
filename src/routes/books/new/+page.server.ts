import { fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { createBook, findBookByUrl, InvalidBook, textFromFile } from '#lib/server/domain/books.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import { fetchArticle, InvalidAddress } from '#lib/server/domain/webpages.ts';
import type { Actions, PageServerLoad } from './$types';

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
	/** Fetches the article at the web address into the form, to edit before creating the Book. */
	fetch: async ({ request }) => {
		const values = valuesOf(await request.formData());
		try {
			const article = await fetchArticle(values.url);
			return { values: { ...values, url: article.url, title: values.title.trim() || article.title, text: article.text }, fetched: true };
		} catch (e) {
			if (e instanceof InvalidAddress) return fail(400, { message: e.message, values });
			throw e;
		}
	},
	create: async ({ request }) => {
		const form = await request.formData();
		const values = valuesOf(form);
		const file = form.get('file');

		const existing = values.url ? await findBookByUrl(database(), values.url) : undefined;
		if (existing !== undefined) return fail(400, { message: 'You already have that page as a Book.', values, existingId: existing });

		let id: number;
		try {
			if (file instanceof File && file.size > 0) {
				if (values.text.trim() !== '') throw new InvalidBook('Paste text or choose a file, not both.');
				const text = textFromFile(new Uint8Array(await file.arrayBuffer()));
				// The title defaults to the file's name.
				const title = values.title.trim() || file.name.replace(/\.txt$/i, '');
				id = await createBook(database(), { ...values, url: undefined, title, text });
			} else {
				id = await createBook(database(), { ...values, url: values.url || undefined });
			}
		} catch (e) {
			if (e instanceof InvalidBook) return fail(400, { message: e.message, values });
			throw e;
		}
		redirect(303, `/books/${id}/pages/1`);
	}
};
