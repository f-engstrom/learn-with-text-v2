<script module lang="ts">
	import { expect, userEvent, within } from 'storybook/test';
	import preview from '../../../../../.storybook/preview';
	import AddPages from './AddPages.svelte';

	const { Story } = preview.meta({ title: 'Components/Edit Book/AddPages', component: AddPages, args: { where: 'after Page 3', lang: 'ru' } });

	/** A stand-in for a phone's photo of a printed page. */
	async function photoOfText(): Promise<File> {
		const canvas = document.createElement('canvas');
		canvas.width = 640;
		canvas.height = 300;
		const g = canvas.getContext('2d')!;
		g.fillStyle = '#f4efe4';
		g.fillRect(0, 0, 640, 300);
		g.fillStyle = '#222';
		g.font = '26px Georgia, serif';
		['Старый мост через реку снова открыт.', 'Его ремонтировали почти два года,', 'и жители города очень ждали этого дня.'].forEach((line, i) =>
			g.fillText(line, 32, 80 + i * 56)
		);
		const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
		return new File([blob], 'page.png', { type: 'image/png' });
	}
</script>

{#snippet list(args: { where: string; open?: boolean; shown?: boolean })}
	<ol style="display: grid; gap: 0.5rem; max-width: 48rem; padding: 1rem 0">
		<AddPages {...args} />
	</ol>
{/snippet}

<Story name="Shown" args={{ shown: true }} template={list} />
<Story name="Open" args={{ open: true }} template={list} />
<Story
	name="With a photo of text"
	args={{ open: true }}
	template={list}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.upload(canvas.getByLabelText(/Photo of text/), await photoOfText());
		await expect(await canvas.findByRole('img', { name: 'Text to copy from' })).toBeInTheDocument();
	}}
/>
