<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import TermPanel from './TermPanel.svelte';

	const { mixed, characters } = fixtures.reading;
	const statusOf = (terms: typeof mixed.terms) => (key: string) => terms[key]?.status ?? 'unknown';
	const of = (key: string, text = key) => ({ selected: { key, text, sentence: 0 }, term: mixed.terms[key], band: mixed.frequency[key] });
	const { Story } = preview.meta({
		title: 'Reading screen/Term panel',
		component: TermPanel,
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })],
		args: {
			language: mixed.language,
			...of('привыкший'),
			parts: undefined,
			statusOf: statusOf(mixed.terms),
			dictionaries: mixed.dictionaries,
			dictionary: undefined,
			error: undefined,
			onclose: fn(),
			onwholeword: fn(),
			onpickcharacter: fn(),
			onstatus: fn(),
			onreview: fn()
		}
	});
</script>

<Story name="A Learning Term, overdue" />
<Story name="An Unknown Word" args={of('блондинка')} />
<Story name="Frequency, Transfer and the Tutor's assessment" args={of('интересоваться')} />
<Story name="A suggested Status" args={of('появилось')} />
<Story name="Refused" args={{ error: 'A Term cannot be its own Parent.' }} />
<Story
	name="Character parts, one picked"
	args={{
		language: characters.language,
		selected: { key: '学', text: '学', sentence: 3 },
		term: characters.terms['学'],
		band: characters.frequency['学'],
		parts: { word: { key: '学习', text: '学习' }, characters: ['学', '习'], picked: [0, 0] },
		statusOf: statusOf(characters.terms),
		dictionaries: characters.dictionaries
	}}
/>
