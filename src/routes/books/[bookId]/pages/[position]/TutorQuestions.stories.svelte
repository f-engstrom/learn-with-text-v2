<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { expect, fn, within } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Text from '#stories/Text.svelte';
	import TutorQuestions from './TutorQuestions.svelte';

	const question = fixtures.tutor.question.question!;
	const order = {
		prompt: 'Put the words in order: a new face had appeared on the seafront.',
		kind: 'order' as const,
		words: ['на', 'набережной', 'появилось', 'новое', 'лицо']
	};
	const gaps = {
		prompt: 'Fill the gaps. Which case does «на» take here?',
		kind: 'gaps' as const,
		text: 'Говорили, что на ___ появилось новое ___.',
		bank: ['набережной', 'лицо', 'набережная', 'лица']
	};
	const typedGap = { prompt: 'Fill the gap with the right form of «привыкнуть».', kind: 'gaps' as const, text: 'Гуров, уже ___ тут, тоже заинтересовался.' };
	const match = {
		prompt: 'Match each word with its meaning.',
		kind: 'match' as const,
		left: ['набережная', 'привыкнуть', 'лицо', 'появиться'],
		right: ['embankment, seafront', 'to get used to', 'face', 'to appear']
	};
	const { Story } = preview.meta({
		title: 'Components/Reading/Tutor questions',
		component: TutorQuestions,
		// As wide as the Page's text, where the Tutor's turn sits.
		decorators: [() => ({ Component: Text })],
		args: { question, lang: 'ru', onanswer: fn(), onleave: fn() }
	});
</script>

<Story name="Options, then a typed answer" />
<Story
	name="Words to put in order"
	args={{ question: { ...question, questions: [order] } }}
	play={async ({ canvas, userEvent, args }) => {
		const send = canvas.getByRole('button', { name: 'Send answer' });
		await expect(send).toBeDisabled();
		const bank = within(canvas.getByRole('group', { name: 'Words' }));
		for (const word of order.words) await userEvent.click(bank.getByRole('button', { name: word }));
		await expect(send).toBeEnabled();
		await userEvent.click(send);
		await expect(args.onanswer).toHaveBeenCalledWith({ answers: [order.words.join(' ')] });
	}}
/>
<Story name="Gaps to fill from a bank" args={{ question: { ...question, questions: [gaps] } }} />
<Story name="A gap to type" args={{ question: { ...question, questions: [typedGap] } }} />
<Story name="Words to match with meanings" args={{ question: { ...question, questions: [match] } }} />
<Story name="Every kind, one after another" args={{ question: { ...question, questions: [gaps, match, order, question.questions[1]] } }} />
<Story name="One typed question" args={{ question: { ...question, questions: [question.questions[1]] } }} />
<Story name="One question with options" args={{ question: { ...question, questions: [question.questions[0]] } }} />
