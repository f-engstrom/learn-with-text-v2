import { json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { recordReview } from '#lib/server/domain/practice.ts';
import { refusedAsError } from '#lib/server/refusals.ts';
import type { RequestHandler } from './$types';

/** Records a Review of the Term, from practice on a Page or the review in the Term list; returns its practice now. */
export const POST: RequestHandler = async ({ params, request }) => {
	const { grade, source }: { grade: string; source: string } = await request.json();
	return json(await refusedAsError(() => recordReview(database(), Number(params.termId), grade, source)));
};
