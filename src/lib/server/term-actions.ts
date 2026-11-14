import type { Action } from '@sveltejs/kit';
import { database } from './database';
import { deleteTerm, saveTerm } from './domain/terms';
import { refusedAsFailure } from './refusals';
import { readTermForm, termFields } from '../term-writes';

// The Term form's actions, shared by every page that shows it (the reading screen and the Term list).

export const saveTermAction: Action = async ({ request }) => {
	return refusedAsFailure(async () => {
		await saveTerm(database(), readTermForm(await request.formData()));
	});
};

export const deleteTermAction: Action = async ({ request }) => {
	const form = await request.formData();
	await deleteTerm(database(), Number(form.get(termFields.id)));
};
