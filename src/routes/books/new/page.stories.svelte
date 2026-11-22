<script module lang="ts">
	import preview from '../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import { photoOfText, pagesSoFar, photosOfPages, readsPages } from '#stories/photos.ts';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Book',
		component: Screen,
		args: { screen: Page, data: routes.newBook },
		parameters: { layout: 'fullscreen', ...at('/books/new') }
	});
</script>

<Story name="New: Empty" />
<Story
	name="New: Text fetched from a web address"
	args={{ form: { fetched: true, values: { languageId: 4, url: "https://ru.wikisource.org/wiki/Ванька_(Чехов)", title: "Ванька", text: "Ванька Жуков, девятилетний мальчик, отданный три месяца тому назад в ученье к сапожнику Аляхину, в ночь под Рождество не ложился спать." } } }}
/>
<Story
	name="New: The Book exists already"
	args={{ form: { message: "You already have a Book from that address.", existingId: 2, values: { languageId: 4, url: "https://example.org/lady", title: "", text: "" } } }}
/>
<Story
	name="New: Text read from photos"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.upload(canvas.getByLabelText(/Choose photos or files/), [await photoOfText('Мост.png'), await photoOfText('2.png')]);
		await waitFor(() => expect(canvas.getAllByText('Read')).toHaveLength(2), { timeout: 3000 });
		await expect(canvas.getByLabelText('Title')).toHaveValue('Мост');
		await expect((canvas.getByLabelText('Text') as HTMLTextAreaElement).value).toMatch(/этого дня\.\nСтарый мост/);
	}}
/>
<Story
	name="New: A photo beside its text"
	parameters={readsPages}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Two Pages are in the box already, and a `---` line to start the next.
		await userEvent.click(canvas.getByLabelText('Text'));
		await userEvent.paste(pagesSoFar);
		await userEvent.upload(canvas.getByLabelText(/Choose photos or files/), await photosOfPages());
		await waitFor(() => expect(canvas.getAllByText('Read')).toHaveLength(3), { timeout: 5000 });
		await expect((canvas.getByLabelText('Text') as HTMLTextAreaElement).value).toMatch(/\n---\nТы должен сделать добро/);
		await userEvent.click(canvas.getByRole('button', { name: 'Show IMG_0320.jpg' }));
		const photo = canvas.getByRole('img', { name: /Photo 2/ }) as HTMLImageElement;
		await waitFor(() => expect(photo.complete && photo.naturalWidth > 0).toBe(true));
	}}
/>
