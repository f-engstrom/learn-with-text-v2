<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import WiktionaryPanel from './WiktionaryPanel.svelte';

	const { Story } = preview.meta({
		title: 'Reading screen/Wiktionary panel',
		component: WiktionaryPanel,
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })],
		args: { language: fixtures.reading.mixed.language, termKey: 'привыкший', text: 'привыкший', translations: [], onadd: fn() }
	});
</script>

<Story name="Definitions" />
<Story name="One already a Translation" args={{ translations: ['accustomed, used to'] }} />
<Story name="Looking up" parameters={{ server: { 'GET /api/wiktionary': { delay: 'never' } } }} />
<Story name="No entry" parameters={{ server: { 'GET /api/wiktionary': { body: null } } }} />
<Story name="Failed" parameters={{ server: { 'GET /api/wiktionary': { status: 502, body: { message: "Couldn't reach Wiktionary" } } } }} />
