<!--
  A button, or a link that looks like one when it has an href. Its look is app.css's base control,
  which a screen's own controls (dictionary tabs, Character parts) build on; use this for the rest.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		/** primary for the screen's one main step; danger for what removes; quiet for what stands aside; link reads as a link. */
		variant?: 'default' | 'primary' | 'danger' | 'quiet' | 'link';
		/** The key that does the same, shown before the label where the screen takes it. */
		key?: string;
		/** A toggle, on or off; leave it out for a plain button. */
		pressed?: boolean;
		/** Makes it a link to there, looking like a button. */
		href?: string;
		children: Snippet;
	}

	let { variant = 'default', key, children, pressed, href, ...rest }: Props = $props();

	let classes = $derived([variant !== 'default' && variant, pressed !== undefined && 'toggle', rest.class]);
</script>

{#snippet label()}{#if key}<kbd>{key}</kbd>{' '}{/if}{@render children()}{/snippet}

{#if href !== undefined}
	<a {...rest as HTMLAnchorAttributes} {href} class={['button', ...classes]}>{@render label()}</a>
{:else}
	<button {...rest as HTMLButtonAttributes} class={classes} aria-pressed={pressed}>{@render label()}</button>
{/if}
