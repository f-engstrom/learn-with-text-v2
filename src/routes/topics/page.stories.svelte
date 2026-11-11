<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Topics',
		component: Screen,
		args: { screen: Page, data: routes.topics },
		parameters: { layout: 'fullscreen', ...at('/topics') }
	});
</script>

<Story name="Topics" />
<Story name="No Topics" args={{ data: emptyRoutes.topics }} />
<Story name="Refused" args={{ form: { message: "A Topic needs some text." } }} />
