import { fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { createBook, InvalidBook, textFromFile } from '#lib/server/domain/books.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { languages: await listLanguages(database()) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const values = {
			languageId: Number(form.get('languageId')),
			title: String(form.get('title') ?? ''),
			text: String(form.get('text') ?? '')
		};
		const file = form.get('file');

		let id: number;
		try {
			if (file instanceof File && file.size > 0) {
				if (values.text.trim() !== '') throw new InvalidBook('Paste text or choose a file, not both.');
				const text = textFromFile(new Uint8Array(await file.arrayBuffer()));
				// The title defaults to the file's name.
				const title = values.title.trim() || file.name.replace(/\.txt$/i, '');
				id = await createBook(database(), { ...values, title, text });
			} else {
				id = await createBook(database(), values);
			}
		} catch (e) {
			if (e instanceof InvalidBook) return fail(400, { message: e.message, values });
			throw e;
		}
		redirect(303, `/books/${id}/pages/1`);
	}
};
