<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Feeds',
		component: Screen,
		args: { screen: Page, data: routes.feeds },
		parameters: { layout: 'fullscreen', ...at('/feeds') }
	});
</script>

<Story name="Feeds" />
<Story name="No Feeds" args={{ data: { ...routes.feeds, feeds: [] } }} />
<Story
	name="A Feed was refused"
	args={{ form: { message: "That address has no feed with items.", values: { languageId: 4, url: "https://example.org/", name: "" } } }}
/>
