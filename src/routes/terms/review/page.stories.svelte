<script module lang="ts">
	import preview from '../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Review',
		component: Screen,
		args: { screen: Page, data: routes.review },
		parameters: { layout: 'fullscreen', ...at('/terms/review') }
	});
</script>

<Story name="A Due Term, hidden" />
<Story
	name="Revealed"
	play={async ({ userEvent }: { userEvent: { keyboard: (keys: string) => Promise<void> } }) => {
		await userEvent.keyboard(" ");
	}}
/>
<Story name="Nothing Due" args={{ data: emptyRoutes.review }} />
