<script lang="ts">
	import { lookupUrl, type Dictionary } from '#lib/dictionaries.ts';

	interface Props {
		dictionaries: Dictionary[];
		/** The Normalised form of the selected Word or phrase. */
		term: string;
		/** The open tab, by Dictionary id; the page keeps it while you move between Words. */
		chosen: number | undefined;
	}

	let { dictionaries, term, chosen = $bindable() }: Props = $props();

	let embedded = $derived(dictionaries.filter((d) => d.display === 'embedded'));
	let popups = $derived(dictionaries.filter((d) => d.display === 'popup'));
	let shown = $derived(embedded.find((d) => d.id === chosen) ?? embedded[0]);

	function openPopup(dictionary: Dictionary) {
		window.open(lookupUrl(dictionary, term), 'dictionary', 'popup,width=760,height=820');
	}
</script>

<section class="dictionaries" aria-label="Dictionaries">
	<div class="tabs" role="tablist">
		{#each embedded as dictionary (dictionary.id)}
			<button type="button" role="tab" aria-selected={dictionary === shown} onclick={() => (chosen = dictionary.id)}
				>{dictionary.name}</button
			>
		{/each}
		{#each popups as dictionary (dictionary.id)}
			<button type="button" class="popup" title="Opens in a new window" onclick={() => openPopup(dictionary)}
				>{dictionary.name} ↗</button
			>
		{/each}
	</div>
	{#if shown}
		<!-- Sandboxed so a dictionary site can't navigate the reading screen away. -->
		<iframe
			title="{shown.name}: {term}"
			src={lookupUrl(shown, term)}
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
			referrerpolicy="no-referrer"
		></iframe>
	{/if}
</section>

<style>
	.dictionaries {
		display: grid;
		gap: 0.5rem;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.tabs button {
		padding: 0.15rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		background: var(--surface-2);
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	/* iOS Safari widens an iframe to its page's width; a 1px width with a full min-width keeps it in the panel. */
	iframe {
		width: 1px;
		min-width: 100%;
		height: 28rem;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
	}
</style>
