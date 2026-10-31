import { error, json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getHighlight } from '#lib/server/domain/reading.ts';
import { getTutorQuestion } from '#lib/server/domain/tutor-question.ts';
import { termsVersion } from '#lib/server/domain/terms.ts';
import type { RequestHandler } from './$types';

/**
 * The Book's Highlight and Tutor's question (or nulls), and its Language's Terms version: the reading
 * screen polls this to show what the Tutor sets, and reloads its Terms when the version moves on.
 */
export const GET: RequestHandler = async ({ params }) => {
	const bookId = Number(params.bookId);
	const book = await database().selectFrom('book').select('language_id').where('id', '=', bookId).executeTakeFirst();
	if (!book) error(404, 'Book not found');
	return json({
		highlight: (await getHighlight(database(), bookId)) ?? null,
		question: (await getTutorQuestion(database(), bookId)) ?? null,
		termsVersion: await termsVersion(database(), book.language_id)
	});
};
