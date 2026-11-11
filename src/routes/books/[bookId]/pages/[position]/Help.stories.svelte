<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import Column from '#stories/Column.svelte';
	import Help from './Help.svelte';

	const { Story } = preview.meta({
		title: 'Reading screen/Help',
		component: Help,
		decorators: [() => ({ Component: Column })]
	});
</script>

<Story name="Keys closed" />
<Story
	name="Keys open"
	play={async ({ canvas, userEvent }: { canvas: { getByText: (text: string) => HTMLElement }; userEvent: { click: (element: Element) => Promise<void> } }) => {
		await userEvent.click(canvas.getByText('Keys'));
	}}
/>
