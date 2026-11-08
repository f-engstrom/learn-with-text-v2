import { fail, type Action } from '@sveltejs/kit';
import { database } from './database';
import { deleteTerm, InvalidTerm, saveTerm } from './domain/terms';

// The Term form's actions, shared by every page that shows it (the reading screen and the Term list).

export const saveTermAction: Action = async ({ request }) => {
	const form = await request.formData();
	const ids = form.getAll('translationId').map(String);
	const sources = form.getAll('translationSource').map(String);
	try {
		await saveTerm(database(), {
			languageId: Number(form.get('languageId')),
			text: String(form.get('text') ?? ''),
			status: String(form.get('status') ?? ''),
			pronunciation: String(form.get('pronunciation') ?? ''),
			parent: String(form.get('parent') ?? ''),
			followsParent: form.get('followsParent') === 'on',
			translations: form.getAll('translationText').map((text, i) => ({
				id: ids[i] ? Number(ids[i]) : undefined,
				text: String(text),
				source: sources[i]
			}))
		});
	} catch (e) {
		if (e instanceof InvalidTerm) return fail(400, { message: e.message });
		throw e;
	}
};

/** Sets only the Status, creating the Term for an Unknown Word. */
export const setStatusAction: Action = async ({ request }) => {
	const form = await request.formData();
	try {
		await saveTerm(database(), {
			languageId: Number(form.get('languageId')),
			text: String(form.get('text') ?? ''),
			status: String(form.get('status') ?? '')
		});
	} catch (e) {
		if (e instanceof InvalidTerm) return fail(400, { message: e.message });
		throw e;
	}
};

export const deleteTermAction: Action = async ({ request }) => {
	const form = await request.formData();
	await deleteTerm(database(), Number(form.get('id')));
};
