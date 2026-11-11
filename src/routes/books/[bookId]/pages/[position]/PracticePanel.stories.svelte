<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import PracticePanel from './PracticePanel.svelte';

	const terms = fixtures.reading.mixed.terms;
	const { Story } = preview.meta({
		title: 'Reading screen/Practice panel',
		component: PracticePanel,
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })],
		args: {
			subsets: [
				{ subset: 'priority', count: 7 },
				{ subset: 'paragraph', count: 5 },
				{ subset: 'highlight', count: 2 },
				{ subset: 'overdue', count: 7 }
			],
			text: undefined,
			term: undefined,
			onpick: fn(),
			onreveal: fn(),
			ongrade: fn(),
			onstop: fn()
		}
	});
	const run = { stage: 'run' as const, subset: 'priority' as const, queue: [3, 9, 14, 20], at: 1, reviewed: 1 };
</script>

<Story name="Choosing a subset" args={{ state: { stage: 'choose' } }} />
<Story
	name="Nothing Due"
	args={{ state: { stage: 'choose' }, subsets: [{ subset: 'priority', count: 0 }, { subset: 'paragraph', count: 0 }, { subset: 'highlight', count: 0 }, { subset: 'overdue', count: 0 }] }}
/>
<Story name="Recalling" args={{ state: { ...run, revealed: false }, text: 'привыкший', term: terms['привыкший'] }} />
<Story name="Revealed" args={{ state: { ...run, revealed: true }, text: 'привыкший', term: terms['привыкший'] }} />
<Story name="Revealed, with a Parent" args={{ state: { ...run, revealed: true }, text: 'лицами', term: terms['лицами'] }} />
<Story name="Done" args={{ state: { stage: 'done', reviewed: 4 } }} />
