<script module lang="ts">
	import { expect, userEvent, within } from 'storybook/test';
	import preview from '../../../../../.storybook/preview';
	import AddPages from './AddPages.svelte';
	import { photoOfText } from '#stories/photos.ts';

	const { Story } = preview.meta({ title: 'Components/Edit Book/AddPages', component: AddPages, args: { where: 'after Page 3', lang: 'ru', languageId: 4 } });
</script>

{#snippet list(args: { where: string; languageId: number; open?: boolean; shown?: boolean })}
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
		await expect(await canvas.findByText('Read')).toBeInTheDocument();
		await expect(canvas.getByRole('textbox')).toHaveValue(
			'Старый мост через реку снова открыт. Его ремонтировали почти два года, и жители города очень ждали этого дня.'
		);
		await expect(canvas.getByRole('button', { name: 'Add a Page' })).toBeEnabled();
	}}
/>
