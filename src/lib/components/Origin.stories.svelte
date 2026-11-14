<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Origin from './Origin.svelte';

	const { Story } = preview.meta({ title: 'Components/Origin', component: Origin });
</script>

<Story
	name="A chain and a cognate, English one of Your languages"
	args={{
		origin: {
			links: [
				{ kind: 'inherited', language: 'Old East Slavic', word: 'хлѣбъ' },
				{ kind: 'inherited', language: 'Proto-Slavic', word: '*xlěbъ' },
				{ kind: 'derived', language: 'Proto-Germanic', word: '*hlaibaz' },
				{ kind: 'cognate', language: 'English', word: 'loaf' }
			],
			note: 'Inherited from Old East Slavic хлѣбъ, from Proto-Slavic *xlěbъ, from Gothic 𐌷𐌻𐌰𐌹𐍆𐍃, from Proto-Germanic *hlaibaz. Cognate with English loaf.',
			source: 'wiktionary'
		},
		yourLanguages: ['Swedish', 'English']
	}}
/>

<Story
	name="A loanword you wrote"
	args={{ origin: { links: [{ kind: 'loanword', language: 'English', word: 'Vauxhall' }], note: 'After Vauxhall Gardens in London.', source: 'you' } }}
/>

<Story
	name="Its Parent's, from the Tutor"
	args={{ origin: { links: [{ kind: 'loanword', language: 'Ottoman Turkish', word: 'çorap' }, { kind: 'loanword', language: 'Persian', word: 'jurāb' }], source: 'tutor', of: 'čarapa' } }}
/>

<Story name="A note only" args={{ origin: { links: [], note: 'Of unclear origin.', source: 'wiktionary' } }} />
