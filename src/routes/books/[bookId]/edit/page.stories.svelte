<script module lang="ts">
	import { expect, userEvent, within } from 'storybook/test';
	import preview from '../../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { messy, many, long } = fixtures.editing;
	const at = (id: number) => ({ sveltekit_experimental: { state: { page: { url: new URL(`/books/${id}/edit`, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Edit Book',
		component: Screen,
		args: { screen: Page, data: messy },
		parameters: { layout: 'fullscreen', ...at(messy.book.id) }
	});
</script>

<Story name="A messy web import" />

<Story
	name="Cleaned up"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const edit = async (start: RegExp, action: string) => {
			await userEvent.click(canvas.getByRole('button', { name: start }));
			await userEvent.click(canvas.getByRole('button', { name: action }));
		};
		// The menu, "Read also" and the footer go; the cut-off fragment joins the Page before it.
		await edit(/^Главная/, 'Remove');
		await edit(/^Читайте также/, 'Remove');
		await edit(/^©/, 'Remove');
		await edit(/^Вечером на мосту/, 'Join with next');
		await expect(canvas.getByText(/4 Pages · 2 Read/)).toBeInTheDocument();
	}}
/>

<Story name="Many Pages" args={{ data: many }} parameters={at(many.book.id)} />

<Story
	name="Adding Pages in the middle"
	args={{ data: many }}
	parameters={at(many.book.id)}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Add Pages after Page 12' }));
		await userEvent.type(canvas.getByRole('textbox', { name: /Add Pages after Page 12/ }), 'Первая новая.{enter}---{enter}Вторая новая.');
		await userEvent.click(canvas.getByRole('button', { name: 'Add 2 Pages' }));
		await expect(canvas.getByText(/42 Pages/)).toBeInTheDocument();
		await expect(canvas.getByRole('button', { name: 'Bookmark on Page 15' })).toBeInTheDocument();
	}}
/>

<Story name="A Page longer than usual" args={{ data: long }} parameters={at(long.book.id)} />

<Story name="Refused" args={{ form: { message: 'Another Book came from that web address.' } }} />

<Story name="A short Book" args={{ data: fixtures.routes.editBook! }} parameters={at(fixtures.routes.editBook!.book.id)} />
