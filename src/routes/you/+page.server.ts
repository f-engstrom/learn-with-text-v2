import { database } from '#lib/server/database.ts';
import { listYourLanguages, removeYourLanguage, setYourLanguage } from '#lib/server/domain/your-languages.ts';
import { refusedAsFailure } from '#lib/server/refusals.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ languages: await listYourLanguages(database()) });

export const actions: Actions = {
	set: async ({ request }) => {
		const form = await request.formData();
		return refusedAsFailure(() => setYourLanguage(database(), { name: String(form.get('name') ?? ''), level: String(form.get('level') ?? '') }));
	},
	remove: async ({ request }) => {
		const form = await request.formData();
		await removeYourLanguage(database(), String(form.get('name') ?? ''));
	}
};
