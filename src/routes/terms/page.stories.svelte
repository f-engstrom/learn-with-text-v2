<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Terms',
		component: Screen,
		args: { screen: Page, data: routes.terms },
		parameters: { layout: 'fullscreen', ...at('/terms') }
	});
</script>

<Story name="Terms in every Status" />
<Story name="No Terms" args={{ data: emptyRoutes.terms }} />
<Story name="Filtered, nothing matches" args={{ data: { ...routes.terms, terms: [], total: 0, filter: { ...routes.terms.filter, q: "собака", status: "known" } } }} parameters={at("/terms?q=собака&status=known")} />
<Story
	name="A Term form open"
	play={async ({ canvas, userEvent }: { canvas: { getAllByRole: (role: string, options: { name: RegExp }) => HTMLElement[] }; userEvent: { click: (element: Element) => Promise<void> } }) => {
		await userEvent.click(canvas.getAllByRole("button", { name: /edit/i })[2]);
	}}
/>
