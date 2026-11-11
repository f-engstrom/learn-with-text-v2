<!-- A one-line form that adds something to a list: its fields, its button, and what was refused. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';

	interface Props {
		action: string;
		/** The button's words: "Add Topic". */
		label: string;
		/** Why the last add was refused, if it was. */
		message?: string;
		children: Snippet;
	}

	let { action, label, message, children }: Props = $props();
</script>

<form method="POST" {action} class="add" use:enhance>
	{@render children()}
	<Button>{label}</Button>
</form>
{#if message}
	<p class="error" role="alert">{message}</p>
{/if}

<style>
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	/* The text box takes the room; a select beside it keeps its own width. */
	.add :global(input:not([type='hidden'])) {
		flex: 1 1 14rem;
		max-width: 24rem;
	}
</style>
