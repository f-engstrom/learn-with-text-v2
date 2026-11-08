import { error } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { InvalidBookmark, setBookmark } from '#lib/server/domain/reading.ts';
import type { Bookmark } from '#lib/server/domain/books.ts';
import type { RequestHandler } from './$types';

/** Moves the Bookmark: the reading screen sends it as the Selection moves. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const { page, sentence, word }: Bookmark = await request.json();
	try {
		await setBookmark(database(), Number(params.bookId), { page, sentence, ...(word ? { word } : {}) });
	} catch (e) {
		if (e instanceof InvalidBookmark) error(400, e.message);
		throw e;
	}
	return new Response(null, { status: 204 });
};
