<script module lang="ts">
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import preview from '../../../.storybook/preview';
	import RecogniseFiles from './RecogniseFiles.svelte';
	import { photoOfText } from '#stories/photos.ts';

	const { Story } = preview.meta({
		title: 'Components/RecogniseFiles',
		component: RecogniseFiles,
		args: { languageId: 4, onread: () => {} }
	});
</script>

<Story name="Nothing chosen" />
<Story
	name="Photos read in order"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.upload(canvas.getByLabelText(/Choose photos or files/), [await photoOfText('1.png'), await photoOfText('2.png')]);
		await waitFor(() => expect(canvas.getAllByText('Read')).toHaveLength(2), { timeout: 3000 });
		await userEvent.click(canvas.getByRole('button', { name: 'Show 2.png' }));
		await expect(canvas.getByRole('img', { name: /Photo 2/ })).toBeInTheDocument();
	}}
/>
<Story
	name="Reading"
	parameters={{ server: { 'POST /languages/*/recognise': { delay: 'never' } } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.upload(canvas.getByLabelText(/Choose photos or files/), [await photoOfText('1.png'), await photoOfText('2.png')]);
		await expect(await canvas.findByText('Reading…')).toBeInTheDocument();
		await expect(canvas.getByText('Waiting')).toBeInTheDocument();
	}}
/>
<Story
	name="A photo that couldn't be read"
	parameters={{ server: { 'POST /languages/*/recognise': { status: 400, body: { message: 'Text recognition needs the Mac helper: run `pnpm build:native`.' } } } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.upload(canvas.getByLabelText(/Choose photos or files/), [await photoOfText('1.png'), await photoOfText('2.png')]);
		await expect(await canvas.findByRole('alert')).toHaveTextContent("Couldn't read it");
		await expect(canvas.getByText(/pnpm build:native/)).toBeInTheDocument();
		await expect(canvas.getByText('Waiting')).toBeInTheDocument();
	}}
/>
