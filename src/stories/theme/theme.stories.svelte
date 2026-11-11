<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Colours from './Colours.svelte';
	import Type from './Type.svelte';
	import Shape from './Shape.svelte';
	import Controls from './Controls.svelte';
	import StatusMarks from './StatusMarks.svelte';

	const { Story } = preview.meta({ title: 'Theme' });
</script>

<Story name="Colours">
	{#snippet template()}<Colours />{/snippet}
</Story>

<Story name="Type">
	{#snippet template()}<Type />{/snippet}
</Story>

<Story name="Shape and shadow">
	{#snippet template()}<Shape />{/snippet}
</Story>

<Story name="Controls">
	{#snippet template()}<Controls />{/snippet}
</Story>

<Story name="Status and Due marks">
	{#snippet template()}<StatusMarks />{/snippet}
</Story>
