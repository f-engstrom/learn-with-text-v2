<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import Dictionaries from './Dictionaries.svelte';

	const { Story } = preview.meta({
		title: 'Reading screen/Dictionaries',
		component: Dictionaries,
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })],
		args: { term: 'привыкший', chosen: undefined }
	});
</script>

<Story name="Russian" args={{ dictionaries: fixtures.reading.mixed.dictionaries }} />
<Story name="Chinese" args={{ dictionaries: fixtures.reading.characters.dictionaries, term: '学习' }} />
<Story name="None" args={{ dictionaries: [] }} />
