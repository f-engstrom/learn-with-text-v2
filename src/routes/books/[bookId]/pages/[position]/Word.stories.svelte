<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import Reading from '#stories/Reading.svelte';
	import Word from './Word.svelte';

	const { Story } = preview.meta({
		title: 'Reading screen/Word',
		component: Word,
		// In the reading text's type.
		decorators: [() => ({ Component: Reading })],
		args: { text: 'набережной', status: 'unknown', onchoose: fn() }
	});
</script>

<Story name="Unknown" />
<Story name="Learning 1" args={{ status: 'learning1' }} />
<Story name="Learning 2" args={{ status: 'learning2' }} />
<Story name="Learning 3" args={{ status: 'learning3' }} />
<Story name="Learning 4" args={{ status: 'learning4' }} />
<Story name="Known" args={{ status: 'known' }} />
<Story name="Ignored" args={{ status: 'ignored', text: 'Гуров' }} />
<Story name="The cursor on it" args={{ status: 'learning2', current: true }} />
<Story name="In a selected phrase" args={{ phrase: true }} />
<Story name="A Multi-word Term" args={{ status: 'learning2', multi: true, text: 'дама с собачкой' }} />
<Story name="In the Tutor's passage" args={{ status: 'learning1', inPassage: true }} />
<Story name="Due" args={{ status: 'learning1', due: 1 }} />
<Story name="Overdue" args={{ status: 'learning2', due: 2 }} />
<Story name="Long overdue" args={{ status: 'learning3', due: 3 }} />
<Story name="Zen mode's Translations" args={{ status: 'known', current: true, gloss: 'embankment, seafront' }} />
