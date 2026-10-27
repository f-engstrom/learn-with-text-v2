import { fail } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { addTopic, InvalidTopic, listTopics, removeTopic } from '#lib/server/domain/topics.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ topics: await listTopics(database()) });

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		try {
			await addTopic(database(), String(form.get('text') ?? ''));
		} catch (e) {
			if (e instanceof InvalidTopic) return fail(400, { message: e.message });
			throw e;
		}
	},
	remove: async ({ request }) => {
		const form = await request.formData();
		await removeTopic(database(), Number(form.get('id')));
	}
};
