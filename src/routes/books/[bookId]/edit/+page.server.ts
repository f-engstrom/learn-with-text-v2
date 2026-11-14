import { error, fail, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { editBook, getBook, InvalidBook } from '#lib/server/domain/books.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const book = await getBook(database(), Number(params.bookId));
	if (!book) error(404, 'Book not found');
	return { book, languages: await listLanguages(database()) };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const form = await request.formData();
		const values = {
			title: String(form.get('title') ?? ''),
			languageId: Number(form.get('languageId')),
			text: String(form.get('text') ?? '')
		};
		try {
			await editBook(database(), Number(params.bookId), values);
		} catch (e) {
			if (e instanceof InvalidBook) return fail(400, { message: e.message, values });
			throw e;
		}
		redirect(303, `/books/${params.bookId}`);
	}
};
