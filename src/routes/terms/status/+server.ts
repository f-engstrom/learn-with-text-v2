import { database } from '#lib/server/database.ts';
import { saveTerm } from '#lib/server/domain/terms.ts';
import { refusedAsError } from '#lib/server/refusals.ts';
import type { RequestHandler } from './$types';

/** Sets only a Term's Status, creating the Term for an Unknown Word. */
export const PUT: RequestHandler = async ({ request }) => {
	const { languageId, text, status }: { languageId: number; text: string; status: string } = await request.json();
	await refusedAsError(() => saveTerm(database(), { languageId, text, status }));
	return new Response(null, { status: 204 });
};
