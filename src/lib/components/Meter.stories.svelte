<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Meter from './Meter.svelte';

	const { Story } = preview.meta({ title: 'Components/Meter', component: Meter });
</script>

<Story name="As wide as its column">
	{#snippet template()}
		<div style="display: grid; gap: 1rem; max-width: 20rem">
			<Meter value={0.62} label="62% of the way to 10,000" />
			<Meter value={0} label="None of the way" />
			<Meter value={1} label="All of the way" />
		</div>
	{/snippet}
</Story>

<Story name="In a line of text">
	{#snippet template()}
		<p style="display: inline-flex; align-items: center; gap: 0.6rem">14% <Meter value={0.14} inline /></p>
	{/snippet}
</Story>
