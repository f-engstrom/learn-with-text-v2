import { error, redirect } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getBookmark } from '#lib/server/domain/reading.ts';
import type { PageServerLoad } from './$types';

/** Opening a Book resumes at its Bookmark. */
export const load: PageServerLoad = async ({ params }) => {
	const bookmark = await getBookmark(database(), Number(params.bookId));
	if (!bookmark) error(404, 'Book not found');
	redirect(307, `/books/${params.bookId}/pages/${bookmark.page}`);
};
