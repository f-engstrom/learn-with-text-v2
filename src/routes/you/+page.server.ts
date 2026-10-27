import { fail } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { InvalidYourLanguage, listYourLanguages, removeYourLanguage, setYourLanguage } from '#lib/server/domain/your-languages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ languages: await listYourLanguages(database()) });

export const actions: Actions = {
	set: async ({ request }) => {
		const form = await request.formData();
		try {
			await setYourLanguage(database(), { name: String(form.get('name') ?? ''), level: String(form.get('level') ?? '') });
		} catch (e) {
			if (e instanceof InvalidYourLanguage) return fail(400, { message: e.message });
			throw e;
		}
	},
	remove: async ({ request }) => {
		const form = await request.formData();
		await removeYourLanguage(database(), String(form.get('name') ?? ''));
	}
};
