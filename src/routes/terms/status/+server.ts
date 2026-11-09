import { error } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { InvalidTerm, saveTerm } from '#lib/server/domain/terms.ts';
import type { RequestHandler } from './$types';

/** Sets only a Term's Status, creating the Term for an Unknown Word. */
export const PUT: RequestHandler = async ({ request }) => {
	const { languageId, text, status }: { languageId: number; text: string; status: string } = await request.json();
	try {
		await saveTerm(database(), { languageId, text, status });
	} catch (e) {
		if (e instanceof InvalidTerm) error(400, e.message);
		throw e;
	}
	return new Response(null, { status: 204 });
};
