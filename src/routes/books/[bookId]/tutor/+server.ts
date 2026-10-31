import { json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getHighlight } from '#lib/server/domain/reading.ts';
import { getTutorQuestion } from '#lib/server/domain/tutor-question.ts';
import type { RequestHandler } from './$types';

/** The Book's Highlight and Tutor's question, or nulls: the reading screen polls this to show what the Tutor sets. */
export const GET: RequestHandler = async ({ params }) => {
	const bookId = Number(params.bookId);
	return json({
		highlight: (await getHighlight(database(), bookId)) ?? null,
		question: (await getTutorQuestion(database(), bookId)) ?? null
	});
};
