import { error, json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getLanguage } from '#lib/server/domain/languages.ts';
import { lookUp, wiktionaryFromWeb } from '#lib/server/domain/wiktionary.ts';
import type { RequestHandler } from './$types';

const wiktionary = wiktionaryFromWeb();

/** English Wiktionary's definitions for a Word or phrase: `?language=<id>&key=<Normalised form>&text=<as written>`. */
export const GET: RequestHandler = async ({ url }) => {
	const language = await getLanguage(database(), Number(url.searchParams.get('language')));
	if (!language) error(400, 'Unknown Language');
	const normalised = url.searchParams.get('key') ?? '';
	const text = url.searchParams.get('text') ?? normalised;
	try {
		return json((await lookUp(wiktionary, language, { normalised, text })) ?? null);
	} catch (e) {
		console.error('Wiktionary lookup failed', e);
		error(502, "Couldn't reach Wiktionary");
	}
};
