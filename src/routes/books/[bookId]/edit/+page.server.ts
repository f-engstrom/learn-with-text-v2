import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { database } from '#lib/server/database.ts';
import { editBook, getBookForEditing } from '#lib/server/domain/book-editing.ts';
import { InvalidBook } from '#lib/server/domain/books.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const book = await getBookForEditing(database(), Number(params.bookId));
	if (!book) error(404, 'Book not found');
	return { book, languages: await listLanguages(database()) };
};

/** The Pages as the screen sends them: every kept Page in order, by id, or new. */
const pagesField = z.array(z.object({ id: z.number().int().nullable(), text: z.string(), read: z.boolean().optional() }));

export const actions: Actions = {
	default: async ({ request, params }) => {
		const form = await request.formData();
		let pages;
		try {
			pages = pagesField.parse(JSON.parse(String(form.get('pages') ?? '')));
		} catch {
			return fail(400, { message: 'The Pages didn’t arrive whole; reload the screen and try again.' });
		}
		try {
			await editBook(database(), Number(params.bookId), {
				title: String(form.get('title') ?? ''),
				languageId: Number(form.get('languageId')),
				url: String(form.get('url') ?? ''),
				pages
			});
		} catch (e) {
			if (e instanceof InvalidBook) return fail(400, { message: e.message });
			throw e;
		}
		redirect(303, `/books/${params.bookId}`);
	}
};
