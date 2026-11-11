<!-- A small pill naming what something is: its Language, "Read", a Topic or a feed. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		/** neutral names a kind; accent comes from elsewhere (a feed); ok is done (a Page read). */
		tone?: 'neutral' | 'accent' | 'ok';
		children: Snippet;
	}

	let { tone = 'neutral', children, ...rest }: Props = $props();
</script>

<span {...rest} class={['tag', tone, rest.class]}>{@render children()}</span>

<style>
	.tag {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-family: var(--font-ui);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.accent {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.ok {
		background: color-mix(in srgb, var(--ok) 18%, transparent);
		color: var(--ok);
	}
</style>
