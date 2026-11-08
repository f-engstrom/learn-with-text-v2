import { error, json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { InvalidReview, recordReview } from '#lib/server/domain/practice.ts';
import type { RequestHandler } from './$types';

/** Records a Review of the Term, from practice on a Page or the review in the Term list; returns its practice now. */
export const POST: RequestHandler = async ({ params, request }) => {
	const { grade, source }: { grade: string; source: string } = await request.json();
	try {
		return json(await recordReview(database(), Number(params.termId), grade, source));
	} catch (e) {
		if (e instanceof InvalidReview) error(400, e.message);
		throw e;
	}
};
