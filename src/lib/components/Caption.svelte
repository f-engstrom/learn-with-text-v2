<!-- A small uppercase caption over a figure, a chart or a card: "Words read", "Continue". -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		/** figcaption inside a figure; a span anywhere else. */
		element?: 'span' | 'figcaption';
		children: Snippet;
	}

	let { element = 'span', children, ...rest }: Props = $props();
</script>

<svelte:element this={element} {...rest} class={['caption', rest.class]}>{@render children()}</svelte:element>

<style>
	.caption {
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
</style>
