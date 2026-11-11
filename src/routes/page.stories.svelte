<script module lang="ts">
	import preview from '../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Books',
		component: Screen,
		args: { screen: Page, data: routes.home },
		parameters: { layout: 'fullscreen', ...at('/') }
	});
</script>

<Story name="Books in several Languages" />
<Story name="No Books yet" args={{ data: emptyRoutes.home }} />
