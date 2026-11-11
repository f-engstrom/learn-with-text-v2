<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Screen from '#stories/Screen.svelte';
	import type { Server } from '#stories/server.ts';
	import Page from './+page.svelte';

	const { fresh, mixed, lastPage, rightToLeft, characters, afterRead } = fixtures.reading;
	const { highlight, passage, question, answered } = fixtures.tutor;
	const at = (path: string) => ({ sveltekit_experimental: { state: { page: { url: new URL(path, location.origin) } } } });

	const { Story } = preview.meta({
		title: 'Screens/Reading',
		component: Screen,
		args: { screen: Page, data: mixed },
		parameters: { layout: 'fullscreen', ...at('/books/2/pages/1') }
	});

	type Play = {
		canvas: {
			getAllByRole: (role: string, options: { name: string | RegExp }) => HTMLElement[];
			getByRole: (role: string, options: { name: string | RegExp }) => HTMLElement;
			queryByRole: (role: string, options: { name: string | RegExp }) => HTMLElement | null;
			findByRole: (role: string, options?: { name: string | RegExp }) => Promise<HTMLElement>;
			getByText: (text: string) => HTMLElement;
		};
		userEvent: { click: (element: Element, init?: object) => Promise<void>; keyboard: (keys: string) => Promise<void>; type: (element: Element, text: string) => Promise<void> };
	};
	const word = (canvas: Play['canvas'], text: string, nth = 0) => canvas.getAllByRole('button', { name: text })[nth];
	/** Opens the Term form on a Word. */
	const choose = (text: string) => async ({ canvas, userEvent }: Play) => {
		await userEvent.click(word(canvas, text));
	};

	/** Zen mode's controls leave after a couple of idle seconds; the story is of the screen once they have. */
	const idle = () => new Promise((resolve) => setTimeout(resolve, 2800));

	/** The Tutor asks while the Page is open: the screen's second look finds the question. */
	let looks = 0;
	const arriving: Server = { 'GET /books/*/tutor': () => (++looks > 1 ? { body: question } : { status: 404 }) };
</script>

<Story name="A fresh Page, every Word Unknown" args={{ data: fresh }} parameters={at('/books/1/pages/1')} />

<Story name="Words in every Status" />

<Story
	name="The Keys open"
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.click(canvas.getByText('Keys'));
	}}
/>

<Story name="A Word selected" play={choose('привыкший')} />

<Story name="An Unknown Word selected" play={choose('блондинка')} />

<Story name="A Term with a Parent, Reviews and the Tutor's assessment" play={choose('интересоваться')} />

<Story
	name="A phrase selected"
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.click(word(canvas, 'невысокого'));
		await userEvent.keyboard('{Shift>}');
		await userEvent.click(word(canvas, 'роста'));
		await userEvent.keyboard('{/Shift}');
	}}
/>

<Story name="A Multi-word Term selected" play={choose('дама с собачкой')} />

<Story
	name="A Character part selected"
	args={{ data: characters }}
	parameters={at('/books/4/pages/1')}
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.click(word(canvas, '学习'));
		await userEvent.click(canvas.getAllByRole('button', { name: '学' }).at(-1)!);
	}}
/>

<Story name="Right to left" args={{ data: rightToLeft }} parameters={at('/books/3/pages/1')} />

<Story name="Right to left, a Word selected" args={{ data: rightToLeft }} parameters={at('/books/3/pages/1')} play={choose('اعضای')} />

<Story
	name="Due marks off"
	play={async ({ userEvent }: Play) => {
		await userEvent.keyboard('d');
	}}
/>

<Story
	name="Practice: choosing a subset"
	play={async ({ userEvent }: Play) => {
		await userEvent.keyboard('r');
	}}
/>

<Story
	name="Practice: recalling a Word"
	play={async ({ userEvent }: Play) => {
		await userEvent.keyboard('r');
		await userEvent.keyboard('1');
	}}
/>

<Story
	name="Practice: the Word revealed"
	play={async ({ userEvent }: Play) => {
		await userEvent.keyboard('r');
		await userEvent.keyboard('1');
		await userEvent.keyboard(' ');
	}}
/>

<Story
	name="Practice: done"
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.keyboard('r');
		await userEvent.keyboard('1');
		// Every Word in the subset revealed and got.
		for (let i = 0; i < 20 && canvas.queryByRole('button', { name: /Reveal/ }); i++) {
			await userEvent.keyboard(' ');
			await userEvent.keyboard('3');
		}
		await canvas.findByRole('heading', { name: 'Practice done' });
	}}
/>

<Story
	name="Zen mode"
	play={async ({ userEvent }: Play) => {
		await userEvent.keyboard('z');
		await idle();
	}}
/>

<Story
	name="Zen mode, a Word's Translations"
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.keyboard('z');
		await userEvent.click(word(canvas, 'привыкший'));
		await idle();
	}}
/>

<Story name="From the Tutor: a Highlight" args={{ data: { ...mixed, ...highlight } }} />

<Story name="From the Tutor: a note on a passage" args={{ data: { ...mixed, ...passage } }} />

<Story name="From the Tutor: a question" args={{ data: { ...mixed, ...question } }} />

<Story name="From the Tutor: answered, waiting" args={{ data: { ...mixed, ...answered } }} />

<Story
	name="From the Tutor: answering by typing"
	args={{ data: { ...mixed, ...question } }}
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.click(await canvas.findByRole('button', { name: /A lady with a dog/ }));
		await userEvent.type(await canvas.findByRole('textbox', { name: 'Your answer' }), 'Он здесь уже давно');
	}}
/>

<Story
	name="From the Tutor: asking instead"
	args={{ data: { ...mixed, ...question } }}
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.click(await canvas.findByRole('button', { name: 'Ask the Tutor instead' }));
		await userEvent.type(await canvas.findByRole('textbox', { name: 'Your question for the Tutor' }), 'Is «привыкший» from привыкнуть?');
	}}
/>

<Story
	name="From the Tutor: put off with Later"
	args={{ data: { ...mixed, ...question } }}
	play={async ({ canvas, userEvent }: Play) => {
		await userEvent.click(await canvas.findByRole('button', { name: 'Later' }));
	}}
/>

<Story name="From the Tutor: a question arrives while you read" parameters={{ server: arriving, snapshot: false }} />

<Story name="From the Tutor: its Highlight is on another Page" args={{ data: { ...lastPage, ...passage } }} parameters={at('/books/2/pages/3')} />

<Story name="Wiktionary and Azure looking up" play={choose('привыкший')} parameters={{ server: { 'GET /api/wiktionary': { delay: 'never' }, 'GET /api/azure': { delay: 'never' } } }} />

<Story
	name="Wiktionary and Azure failed"
	play={choose('привыкший')}
	parameters={{ server: { 'GET /api/wiktionary': { status: 502 }, 'GET /api/azure': { status: 503 } } }}
/>

<Story name="Just after Mark as read: the day so far" args={{ data: afterRead }} parameters={at('/books/2/pages/2?read')} />

<Story name="The last Page, Read" args={{ data: lastPage }} parameters={at('/books/2/pages/3')} />

<Story name="A Status was refused" play={async ({ canvas, userEvent }: Play) => {
		await userEvent.click(word(canvas, 'блондинка'));
		await userEvent.keyboard('{Escape}');
		await userEvent.keyboard('1');
		// The server's refusal has come back.
		await canvas.findByRole('alert');
	}} parameters={{ server: { 'PUT /terms/status': { status: 400, body: { message: 'A Term is at most 7 Words.' } } } }} />
