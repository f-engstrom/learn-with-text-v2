<script module lang="ts">
	import preview from '../../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import Page from './+page.svelte';

	const { routes } = fixtures;
	const data = routes.editBook!;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });
	const { Story } = preview.meta({
		title: 'Screens/Edit Book',
		component: Screen,
		args: { screen: Page, data },
		parameters: { layout: 'fullscreen', ...at(`/books/${data.book.id}/edit`) }
	});
</script>

<Story name="As it is" />
<Story
	name="Title missing"
	args={{ form: { message: 'Give the Book a title.', values: { title: '', languageId: data.book.languageId, text: data.book.text } } }}
/>
<Story
	name="Text with no Words"
	args={{ form: { message: 'The text has no Words to read.', values: { title: data.book.title, languageId: data.book.languageId, text: '…' } } }}
/>
