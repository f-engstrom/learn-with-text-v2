<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/You',
		component: Screen,
		args: { screen: Page, data: routes.you },
		parameters: { layout: 'fullscreen', ...at('/you') }
	});
</script>

<Story name="Your languages" />
<Story name="None yet" args={{ data: emptyRoutes.you }} />
<Story name="Refused" args={{ form: { message: "A level is native, fluent or some." } }} />
