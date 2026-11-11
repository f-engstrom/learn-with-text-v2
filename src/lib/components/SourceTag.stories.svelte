<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import SourceTag from './SourceTag.svelte';

	const { Story } = preview.meta({ title: 'Components/Source tag', component: SourceTag });
</script>

<Story name="Every Source">
	{#snippet template()}
		<p style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center">
			<span>accustomed <SourceTag source="wiktionary" /></span>
			<span>used <SourceTag source="azure" /></span>
			<span>used to it <SourceTag source="tutor" /></span>
			<span>yours, with none <SourceTag source="you" /></span>
		</p>
	{/snippet}
</Story>
