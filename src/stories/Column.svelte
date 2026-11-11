<!-- The width of the column beside the text in the reading screen, for what lives there. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="card">{@render children()}</div>

<style>
	div {
		max-width: 24rem;
	}
</style>
