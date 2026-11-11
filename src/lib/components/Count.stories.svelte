<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Count from './Count.svelte';

	const { Story } = preview.meta({ title: 'Components/Count', component: Count });
</script>

<Story name="On a button">
	{#snippet template()}
		<p style="display: flex; gap: 0.4rem">
			<button type="button">Practice<Count value={4} /></button>
			<button type="button">Practice<Count value={128} /></button>
		</p>
	{/snippet}
</Story>
