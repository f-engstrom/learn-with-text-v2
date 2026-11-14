<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import Suggestions from './Suggestions.svelte';

	const { Story } = preview.meta({
		title: 'Components/Reading/Suggestions',
		component: Suggestions,
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })],
		args: { source: 'wiktionary', language: fixtures.reading.mixed.language, termKey: 'привыкший', text: 'привыкший', translations: [], onadd: fn() }
	});
	const azure = { source: 'azure' as const };
</script>

<Story name="Wiktionary: definitions" />
<Story name="Wiktionary: one already a Translation" args={{ translations: ['accustomed, used to'] }} />
<Story name="Wiktionary: looking up" parameters={{ server: { 'GET /api/wiktionary': { delay: 'never' } } }} />
<Story name="Wiktionary: no entry" parameters={{ server: { 'GET /api/wiktionary': { body: null } } }} />
<Story name="Wiktionary: no link, its page beneath" args={{ linked: false }} />
<Story name="Wiktionary: failed" parameters={{ server: { 'GET /api/wiktionary': { status: 502, body: { message: "Couldn't reach Wiktionary" } } } }} />

<Story name="Azure: dictionary entries" args={azure} />
<Story name="Azure: one already a Translation" args={{ ...azure, translations: ['accustomed'] }} />
<Story
	name="Azure: machine translation"
	args={{ ...azure, termKey: 'дама с собачкой', text: 'дама с собачкой' }}
	parameters={{ server: { 'GET /api/azure': { body: { kind: 'translation', entries: [{ partOfSpeech: '', translations: ['lady with a dog'] }] } } } }}
/>
<Story name="Azure: looking up" args={azure} parameters={{ server: { 'GET /api/azure': { delay: 'never' } } }} />
<Story name="Azure: nothing found" args={azure} parameters={{ server: { 'GET /api/azure': { body: null } } }} />
<Story name="Azure: not set up" args={azure} parameters={{ server: { 'GET /api/azure': { status: 503 } } }} />
<Story name="Azure: failed" args={azure} parameters={{ server: { 'GET /api/azure': { status: 502 } } }} />
