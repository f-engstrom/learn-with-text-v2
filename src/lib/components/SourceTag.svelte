<!-- Where a Translation came from: Wiktionary, the Tutor, Azure. A Translation you wrote shows none. -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { sourceLabels } from '#lib/terms.ts';
	import type { Source } from '#lib/server/domain/terms.ts';

	interface Props extends HTMLAttributes<HTMLElement> {
		source: Source;
	}

	let { source, ...rest }: Props = $props();
</script>

{#if source !== 'you'}<small {...rest} class={['source', rest.class]}>{sourceLabels[source]}</small>{/if}

<style>
	.source {
		padding: 0 0.35rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.8rem;
		white-space: nowrap;
	}
</style>
