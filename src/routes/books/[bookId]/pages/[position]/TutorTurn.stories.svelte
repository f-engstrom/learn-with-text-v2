<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Text from '#stories/Text.svelte';
	import TutorTurn from './TutorTurn.svelte';

	const { highlight, passage, question, answered } = fixtures.tutor;
	const { Story } = preview.meta({
		title: 'Reading screen/Tutor turn',
		component: TutorTurn,
		// As wide as the Page's text, where the Tutor's turn sits.
		decorators: [() => Text],
		args: {
			here: true,
			folded: false,
			bookId: 2,
			lang: 'ru',
			dir: 'ltr',
			onanswer: fn(),
			onleave: fn(),
			ondismiss: fn(),
			onfold: fn(),
			onunfold: fn()
		}
	});
</script>

<Story name="A Highlight, no note" args={{ highlight: highlight.highlight, question: null }} />
<Story name="A note on a passage" args={{ highlight: passage.highlight, question: null }} />
<Story name="A question, with feedback and Glosses" args={{ highlight: question.highlight, question: question.question }} />
<Story name="A question with no Highlight" args={{ highlight: null, question: question.question }} />
<Story name="Answered, waiting for the Tutor" args={{ highlight: answered.highlight, question: answered.question }} />
<Story name="Put off with Later" args={{ highlight: question.highlight, question: question.question, folded: true }} />
<Story name="The Highlight is on another Page" args={{ highlight: passage.highlight, question: null, here: false }} />
