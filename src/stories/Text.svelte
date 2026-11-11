<!-- The width of the Page's text in the reading screen, for what sits in it. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div>{@render children()}</div>

<style>
	div {
		max-width: 38rem;
	}
</style>
