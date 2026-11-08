import { error, json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { answerTutor, dismissTutor, fromTutor, InvalidTutorQuestion, type Answer } from '#lib/server/domain/from-tutor.ts';
import type { RequestHandler } from './$types';

/** From the Tutor for the Book: the reading screen polls this, and reloads its Terms when the version moves on. */
export const GET: RequestHandler = async ({ params }) => {
	const state = await fromTutor(database(), Number(params.bookId));
	if (!state) error(404, 'Book not found');
	return json(state);
};

/** Your answer to the Tutor's question asked at `askedAt`, or your own question instead. */
export const POST: RequestHandler = async ({ params, request }) => {
	const { askedAt, answer }: { askedAt: string; answer: Answer } = await request.json();
	try {
		await answerTutor(database(), Number(params.bookId), askedAt, answer);
	} catch (e) {
		if (e instanceof InvalidTutorQuestion) error(400, e.message);
		throw e;
	}
	return new Response(null, { status: 204 });
};

/** Puts the Tutor aside: its question and Highlight leave the screen. */
export const DELETE: RequestHandler = async ({ params }) => {
	await dismissTutor(database(), Number(params.bookId));
	return new Response(null, { status: 204 });
};
