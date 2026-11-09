import { fail, type Action } from '@sveltejs/kit';
import { database } from './database';
import { deleteTerm, InvalidTerm, saveTerm } from './domain/terms';
import { readTermForm, termFields } from '../term-writes';

// The Term form's actions, shared by every page that shows it (the reading screen and the Term list).

export const saveTermAction: Action = async ({ request }) => {
	try {
		await saveTerm(database(), readTermForm(await request.formData()));
	} catch (e) {
		if (e instanceof InvalidTerm) return fail(400, { message: e.message });
		throw e;
	}
};

export const deleteTermAction: Action = async ({ request }) => {
	const form = await request.formData();
	await deleteTerm(database(), Number(form.get(termFields.id)));
};
