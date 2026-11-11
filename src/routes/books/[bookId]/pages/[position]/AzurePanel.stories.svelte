<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import AzurePanel from './AzurePanel.svelte';

	const { Story } = preview.meta({
		title: 'Reading screen/Azure panel',
		component: AzurePanel,
		// As wide as the column beside the text.
		decorators: [() => Column],
		args: { language: fixtures.reading.mixed.language, termKey: 'привыкший', text: 'привыкший', translations: [], onadd: fn() }
	});
</script>

<Story name="Dictionary entries" />
<Story name="One already a Translation" args={{ translations: ['accustomed'] }} />
<Story
	name="Machine translation"
	args={{ termKey: 'дама с собачкой', text: 'дама с собачкой' }}
	parameters={{ server: { 'GET /api/azure': { body: { kind: 'translation', entries: [{ partOfSpeech: '', translations: ['lady with a dog'] }] } } } }}
/>
<Story name="Looking up" parameters={{ server: { 'GET /api/azure': { delay: 'never' } } }} />
<Story name="Nothing found" parameters={{ server: { 'GET /api/azure': { body: null } } }} />
<Story name="Not set up" parameters={{ server: { 'GET /api/azure': { status: 503 } } }} />
<Story name="Failed" parameters={{ server: { 'GET /api/azure': { status: 502 } } }} />
