<!-- The reading text's type and measure, for a Word shown on its own. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<p>{@render children()}</p>

<style>
	p {
		margin: 0;
		padding: 0.5rem 0 2.5rem;
		font-family: var(--font-text);
		font-size: 1.32rem;
		line-height: 2;
		letter-spacing: 0.003em;
	}
</style>
