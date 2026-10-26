import { database } from '#lib/server/database.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { languages: await listLanguages(database()) };
};
