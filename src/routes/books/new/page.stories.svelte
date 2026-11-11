<script module lang="ts">
	import preview from '../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

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
