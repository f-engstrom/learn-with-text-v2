<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Text from '#stories/Text.svelte';
	import TutorQuestions from './TutorQuestions.svelte';

	const question = fixtures.tutor.question.question!;
	const { Story } = preview.meta({
		title: 'Components/Reading/Tutor questions',
		component: TutorQuestions,
		// As wide as the Page's text, where the Tutor's turn sits.
		decorators: [() => ({ Component: Text })],
		args: { question, lang: 'ru', onanswer: fn(), onleave: fn() }
	});
</script>

<Story name="Options, then a typed answer" />
<Story name="One typed question" args={{ question: { ...question, questions: [question.questions[1]] } }} />
<Story name="One question with options" args={{ question: { ...question, questions: [question.questions[0]] } }} />
