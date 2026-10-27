import { fail } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { addFeed, InvalidFeed, listFeeds, readFeedText, removeFeed } from '#lib/server/domain/feeds.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = database();
	return { languages: await listLanguages(db), feeds: await listFeeds(db) };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const values = {
			languageId: Number(form.get('languageId')),
			url: String(form.get('url') ?? ''),
			name: String(form.get('name') ?? '')
		};
		try {
			await addFeed(database(), (url) => readFeedText(url), values);
		} catch (e) {
			if (e instanceof InvalidFeed) return fail(400, { message: e.message, values });
			throw e;
		}
	},
	remove: async ({ request }) => {
		const form = await request.formData();
		await removeFeed(database(), Number(form.get('id')));
	}
};
