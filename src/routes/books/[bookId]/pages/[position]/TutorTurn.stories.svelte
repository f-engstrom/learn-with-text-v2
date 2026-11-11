<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import { fixtures } from '#fixtures';
	import Text from '#stories/Text.svelte';
	import TutorTurn from './TutorTurn.svelte';

	const { highlight, passage, question, answered } = fixtures.tutor;
	const { Story } = preview.meta({
		title: 'Components/Reading/Tutor turn',
		component: TutorTurn,
		// As wide as the Page's text, where the Tutor's turn sits.
		decorators: [() => ({ Component: Text })],
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

	type Play = {
		canvas: {
			getByRole: (role: string, options: { name: string | RegExp }) => HTMLElement;
			findByRole: (role: string, options: { name: string | RegExp }) => Promise<HTMLElement>;
		};
		userEvent: { click: (element: Element) => Promise<void>; type: (element: Element, text: string) => Promise<void> };
	};

	/** Picks the first question's answer, then types the second: the last question, so Enter would send. */
	const typedAnswer = async ({ canvas, userEvent }: Play) => {
		await userEvent.click(canvas.getByRole('button', { name: /A lady with a dog/ }));
		await userEvent.type(await canvas.findByRole('textbox', { name: 'Your answer' }), 'Он здесь уже давно');
	};

	/** Your own question in place of the round. */
	const askingInstead = async ({ canvas, userEvent }: Play) => {
		await userEvent.click(canvas.getByRole('button', { name: 'Ask the Tutor instead' }));
		await userEvent.type(await canvas.findByRole('textbox', { name: 'Your question for the Tutor' }), 'Is «привыкший» from привыкнуть?');
	};
</script>

<!-- The states in the order of the design review's "Tutor turn, every state". -->
<Story name="A Highlight, no note" args={{ highlight: highlight.highlight, question: null }} />
<Story name="A Highlight with a note" args={{ highlight: passage.highlight, question: null }} />
<Story name="Feedback and the new round" args={{ highlight: question.highlight, question: question.question }} />
<Story name="A question with no Highlight" args={{ highlight: null, question: question.question }} />
<Story name="A typed answer" args={{ highlight: question.highlight, question: question.question }} play={typedAnswer} />
<Story name="Asking instead" args={{ highlight: question.highlight, question: question.question }} play={askingInstead} />
<Story name="Sent, waiting" args={{ highlight: answered.highlight, question: answered.question }} />
<Story name="Later" args={{ highlight: question.highlight, question: question.question, folded: true }} />
<Story name="About another Page" args={{ highlight: question.highlight, question: question.question, here: false }} />
<Story name="A note on another Page" args={{ highlight: passage.highlight, question: null, here: false }} />
<Story
	name="Phone"
	args={{ highlight: question.highlight, question: question.question }}
	globals={{ viewport: { value: 'phone' } }}
/>
