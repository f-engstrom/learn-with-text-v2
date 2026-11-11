<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Progress',
		component: Screen,
		args: { screen: Page, data: routes.progress },
		parameters: { layout: 'fullscreen', ...at('/progress') }
	});
</script>

<Story name="Some weeks in, a Milestone passed" />
<Story name="Nothing read yet" args={{ data: emptyRoutes.progress }} />
