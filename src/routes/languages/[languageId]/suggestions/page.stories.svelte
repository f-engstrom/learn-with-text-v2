<script module lang="ts">
	import preview from '../../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import type { Suggestion } from '#lib/suggestions.ts';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes, emptyRoutes } = fixtures;
	/** What Wikipedia, Wikisource and the Feeds might answer; the Unknown shares straddle the Fit range. */
	const found: Suggestion[] = [
		{ title: 'Юрий Гагарин', url: 'https://ru.wikipedia.org/wiki/Гагарин', topic: 'космос', unknownShare: 0.11, pageCount: 2 },
		{ title: 'Каштанка', url: 'https://ru.wikisource.org/wiki/Каштанка', author: 'Антон Чехов', unknownShare: 0.14, pageCount: 3 },
		{ title: 'Учёные нашли новую планету', url: 'https://example.org/planet', feed: 'Новости науки', unknownShare: 0.08, pageCount: 1 },
		{ title: 'Пётр I', url: 'https://ru.wikipedia.org/wiki/Пётр_I', topic: 'история', unknownShare: 0.27, pageCount: 9 },
		{ title: 'Байкал', url: 'https://ru.wikipedia.org/wiki/Байкал', unknownShare: 0.19, pageCount: 4 },
		{ title: 'Как птицы находят дорогу домой', url: 'https://example.org/birds', feed: 'Новости науки', unknownShare: 0.03, pageCount: 1 }
	];
	const withSuggestions = (suggestions: Promise<unknown>, data = routes.suggestions) => ({ ...data, suggestions });
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Suggestions',
		component: Screen,
		args: { screen: Page, data: withSuggestions(Promise.resolve({ found })) },
		parameters: { layout: 'fullscreen', ...at('/languages/4/suggestions') }
	});
</script>

<Story name="Suggestions, ranked by the Fit range" />
<Story name="Looking" args={{ data: withSuggestions(new Promise(() => {})) }} />
<Story name="Nothing found" args={{ data: withSuggestions(Promise.resolve({ found: [] })) }} />
<Story
	name="Couldn't reach the sources"
	args={{ data: withSuggestions(Promise.resolve({ failed: "Couldn't reach Wikipedia, Wikisource or the Feeds. Try again in a moment." })) }}
/>
<Story name="No Topics yet" args={{ data: withSuggestions(Promise.resolve({ found: found.map(({ topic, ...rest }) => rest) }), emptyRoutes.suggestions) }} />
<Story name="An article couldn't be imported" args={{ form: { message: "Couldn't fetch the article." } }} />
