import { database } from '#lib/server/database.ts';
import { addTopic, listTopics, removeTopic } from '#lib/server/domain/topics.ts';
import { refusedAsFailure } from '#lib/server/refusals.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ topics: await listTopics(database()) });

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		return refusedAsFailure(() => addTopic(database(), String(form.get('text') ?? '')));
	},
	remove: async ({ request }) => {
		const form = await request.formData();
		await removeTopic(database(), Number(form.get('id')));
	}
};
