<script module lang="ts">
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import preview from '../../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';
	import { pagesSoFar, photosOfPages, readsPages } from '#stories/photos.ts';

	const { messy, many, long, chapters } = fixtures.editing;
	const at = (id: number) => ({ sveltekit_experimental: { state: { page: { url: new URL(`/books/${id}/edit`, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Book',
		component: Screen,
		args: { screen: Page, data: messy },
		parameters: { layout: 'fullscreen', ...at(messy.book.id) }
	});
</script>

<Story name="Edit: A messy web import" />

<Story
	name="Edit: Cleaned up"
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

<Story name="Edit: Many Pages" args={{ data: many }} parameters={at(many.book.id)} />

<Story
	name="Edit: Adding Pages in the middle"
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

<Story
	name="Edit: A photo beside new Pages"
	args={{ data: many }}
	parameters={{ ...at(many.book.id), ...readsPages }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Add Pages after Page 12' }));
		// Two Pages are in the box already, and a `---` line to start the next.
		await userEvent.click(canvas.getByRole('textbox', { name: /Add Pages after Page 12/ }));
		await userEvent.paste(pagesSoFar);
		await userEvent.upload(canvas.getByLabelText(/Choose photos or files/), await photosOfPages());
		await waitFor(() => expect(canvas.getAllByText('Read')).toHaveLength(3), { timeout: 5000 });
		await expect((canvas.getByRole('textbox', { name: /Add Pages after Page 12/ }) as HTMLTextAreaElement).value).toMatch(/\n---\nТы должен сделать добро/);
		await userEvent.click(canvas.getByRole('button', { name: 'Show IMG_0320.jpg' }));
		const photo = canvas.getByRole('img', { name: /Photo 2/ }) as HTMLImageElement;
		await waitFor(() => expect(photo.complete && photo.naturalWidth > 0).toBe(true));
	}}
/>

<Story name="Edit: A Page longer than usual" args={{ data: long }} parameters={at(long.book.id)} />

<Story name="Edit: Refused" args={{ form: { message: 'Another Book came from that web address.' } }} />

<Story name="Edit: A short Book" args={{ data: fixtures.routes.editBook! }} parameters={at(fixtures.routes.editBook!.book.id)} />

<Story name="Edit: A Book in Chapters" args={{ data: chapters }} parameters={at(chapters.book.id)} />

<Story
	name="Edit: Marking where a Chapter starts"
	args={{ data: chapters }}
	parameters={at(chapters.book.id)}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getAllByRole('button', { name: 'Start a Chapter here' })[0]);
		// The card opens at the new Chapter's title.
		await userEvent.keyboard('Предисловие');
		await expect(canvas.getByRole('textbox', { name: 'Title of the Chapter Page 1 starts' })).toHaveValue('Предисловие');
		// The Chapters after it are numbered on.
		await expect(canvas.getAllByText(/^Chapter \d$/).map((e) => e.textContent)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4']);
	}}
/>
