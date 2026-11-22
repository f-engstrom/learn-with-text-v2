<script module lang="ts">
	import preview from '../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import { photoOfText } from '#stories/photos.ts';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/New Book',
		component: Screen,
		args: { screen: Page, data: routes.newBook },
		parameters: { layout: 'fullscreen', ...at('/books/new') }
	});
</script>

<Story name="Empty" />
<Story
	name="Text fetched from a web address"
	args={{ form: { fetched: true, values: { languageId: 4, url: "https://ru.wikisource.org/wiki/Ванька_(Чехов)", title: "Ванька", text: "Ванька Жуков, девятилетний мальчик, отданный три месяца тому назад в ученье к сапожнику Аляхину, в ночь под Рождество не ложился спать." } } }}
/>
<Story
	name="The Book exists already"
	args={{ form: { message: "You already have a Book from that address.", existingId: 2, values: { languageId: 4, url: "https://example.org/lady", title: "", text: "" } } }}
/>
<Story
	name="Text read from photos"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.upload(canvas.getByLabelText(/Choose photos or files/), [await photoOfText('Мост.png'), await photoOfText('2.png')]);
		await waitFor(() => expect(canvas.getAllByText('Read')).toHaveLength(2), { timeout: 3000 });
		await expect(canvas.getByLabelText('Title')).toHaveValue('Мост');
		await expect((canvas.getByLabelText('Text') as HTMLTextAreaElement).value).toMatch(/этого дня\.\nСтарый мост/);
	}}
/>
