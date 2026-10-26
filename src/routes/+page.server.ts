import { database } from '#lib/server/database.ts';
import { listBooks } from '#lib/server/domain/books.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = database();
	return { languages: await listLanguages(db), books: await listBooks(db) };
};
