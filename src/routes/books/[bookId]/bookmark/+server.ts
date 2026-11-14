import { database } from '#lib/server/database.ts';
import { setBookmark } from '#lib/server/domain/reading.ts';
import { refusedAsError } from '#lib/server/refusals.ts';
import type { Bookmark } from '#lib/server/domain/books.ts';
import type { RequestHandler } from './$types';

/** Moves the Bookmark: the reading screen sends it as the Selection moves. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const { page, sentence, word }: Bookmark = await request.json();
	await refusedAsError(() => setBookmark(database(), Number(params.bookId), { page, sentence, ...(word ? { word } : {}) }));
	return new Response(null, { status: 204 });
};
