<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import DictionaryPanel from './DictionaryPanel.svelte';

	const { mixed, characters } = fixtures.reading;
	const { Story } = preview.meta({
		title: 'Components/Reading/Dictionary panel',
		component: DictionaryPanel,
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })],
		args: {
			language: mixed.language,
			termKey: 'привыкший',
			text: 'привыкший',
			translations: [],
			dictionaries: mixed.dictionaries,
			wiktionaryPage: mixed.wiktionaryPage,
			azureReady: true,
			open: 'wiktionary',
			onchoose: fn(),
			onadd: fn()
		}
	});
	const embedded = mixed.dictionaries.find((d) => d.display === 'embedded')!.id;
</script>

<Story name="Closed" args={{ open: null }} />
<Story name="Wiktionary open" />
<Story name="Azure open" args={{ open: 'azure' }} />
<Story name="Azure not set up" args={{ open: 'azure', azureReady: false }} />
<Story name="Azure not set up, Wiktionary open" args={{ azureReady: false }} />
<Story name="A Dictionary's page open" args={{ open: embedded }} />
<Story
	name="Chinese"
	args={{ language: characters.language, termKey: '学习', text: '学习', dictionaries: characters.dictionaries, wiktionaryPage: characters.wiktionaryPage, open: null }}
/>
<Story name="Wiktionary, no page of its own" args={{ dictionaries: [], wiktionaryPage: null }} />
