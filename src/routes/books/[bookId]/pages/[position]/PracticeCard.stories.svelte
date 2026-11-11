<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import PracticeCard from './PracticeCard.svelte';

	const terms = fixtures.reading.mixed.terms;
	const { Story } = preview.meta({
		title: 'Components/Reading/Practice card',
		component: PracticeCard,
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })],
		args: { onreview: fn() }
	});
</script>

<Story name="Never reviewed" args={{ term: terms['набережной'] }} />
<Story name="Due" args={{ term: terms['проживший'] }} />
<Story name="Long overdue" args={{ term: terms['привыкший'] }} />
<Story name="Not Due yet" args={{ term: terms['интересоваться'] }} />
