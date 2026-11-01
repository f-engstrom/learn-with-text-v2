import { AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION } from '$app/env/private';
import { error, json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { azureFromWeb, lookUp } from '#lib/server/domain/azure.ts';
import { getLanguage } from '#lib/server/domain/languages.ts';
import type { RequestHandler } from './$types';

const azure = AZURE_TRANSLATOR_KEY ? azureFromWeb(AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION) : undefined;

/** Azure Translator's English translations of a Word or phrase: `?language=<id>&key=<Normalised form>&text=<as written>`. */
export const GET: RequestHandler = async ({ url }) => {
	if (!azure) error(503, 'Azure Translator is not set up');
	const language = await getLanguage(database(), Number(url.searchParams.get('language')));
	if (!language) error(400, 'Unknown Language');
	const normalised = url.searchParams.get('key') ?? '';
	const text = url.searchParams.get('text') ?? normalised;
	try {
		return json((await lookUp(azure, language, { normalised, text })) ?? null);
	} catch (e) {
		console.error('Azure Translator lookup failed', e);
		error(502, "Couldn't reach Azure Translator");
	}
};
