import { error } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getPage } from '#lib/server/domain/books.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const page = await getPage(database(), Number(params.bookId), Number(params.position));
	if (!page) error(404, 'Page not found');
	return page;
};
