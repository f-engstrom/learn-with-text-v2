import { json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { setFitRange } from '#lib/server/domain/suggestions.ts';
import type { FitRange } from '#lib/suggestions.ts';
import type { RequestHandler } from './$types';

/** Sets the Language's Fit range, as shares from 0 to 1; returns it as saved (clamped and in order). */
export const PUT: RequestHandler = async ({ params, request }) => {
	const range: FitRange = await request.json();
	return json(await setFitRange(database(), Number(params.languageId), range));
};
