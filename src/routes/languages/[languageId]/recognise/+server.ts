import { error, json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getLanguage } from '#lib/server/domain/languages.ts';
import { recogniseUploads, visionReader } from '#lib/server/domain/recognise.ts';
import { refusedAsError } from '#lib/server/refusals.ts';
import type { RequestHandler } from './$types';

const read = visionReader();

/**
 * Reads the text in the uploaded `files` (photos, PDFs, text files) in the Language, in order:
 * `{ text }`, for the learner to check before it becomes Pages. The files aren't kept (ADR 0010).
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const language = await getLanguage(database(), Number(params.languageId));
	if (!language) error(404, 'No such Language.');
	const form = await request.formData();
	const files = await Promise.all(
		form
			.getAll('files')
			.filter((f): f is File => f instanceof File && f.size > 0)
			.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))
	);
	return json({ text: await refusedAsError(() => recogniseUploads(read, language, files)) });
};
