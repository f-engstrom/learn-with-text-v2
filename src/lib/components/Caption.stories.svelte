<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Caption from './Caption.svelte';

	const { Story } = preview.meta({ title: 'Components/Caption', component: Caption });
</script>

<Story name="Over a figure and a chart">
	{#snippet template()}
		<div style="display: grid; gap: 1.5rem">
			<div style="display: grid; gap: 0.3rem">
				<Caption>Words read</Caption>
				<strong style="font-size: 2rem">12,480</strong>
			</div>
			<figure style="margin: 0">
				<Caption element="figcaption">Due forecast</Caption>
			</figure>
		</div>
	{/snippet}
</Story>
