import { error } from '@sveltejs/kit';
import { photoPreview } from '#lib/server/domain/recognise.ts';
import { refusedAsError } from '#lib/server/refusals.ts';
import type { RequestHandler } from './$types';

/** The uploaded `file`, a photo the browser can't show (HEIC outside Safari), as a JPEG to show instead. */
export const POST: RequestHandler = async ({ request }) => {
	const file = (await request.formData()).get('file');
	if (!(file instanceof File) || file.size === 0) error(400, 'Send a photo.');
	const jpeg = await refusedAsError(async () => photoPreview({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }));
	return new Response(new Blob([jpeg as Uint8Array<ArrayBuffer>]), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
};
