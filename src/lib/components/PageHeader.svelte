<!-- A screen's title, with what it offers to do beside it (a link or a small form) and, under it, a lede. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		/** Beside the title: a primary link, a filter. */
		children?: Snippet;
		/** Under the title: what the screen is for, or where it stands. */
		lede?: Snippet;
	}

	let { title, children, lede }: Props = $props();
</script>

<header class="page-header">
	<h1>{title}</h1>
	{@render children?.()}
</header>
{#if lede}<p class="lede">{@render lede()}</p>{/if}

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
		margin-bottom: 1.5rem;
	}
	h1 {
		margin: 0;
	}
</style>
