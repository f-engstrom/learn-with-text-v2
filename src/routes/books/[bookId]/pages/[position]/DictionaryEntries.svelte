<!--
	A dictionary's answer beside the text, the Wiktionary and Azure panels alike: a heading, then
	"Looking up…", why it failed, that there's nothing, or its entries, each meaning a button that adds it as a Translation.
-->
<script module lang="ts">
	/** One part of speech and its meanings, each a possible Translation. */
	export interface Entry {
		partOfSpeech?: string;
		meanings: string[];
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Its name, as the heading and for screen readers. */
		name: string;
		label?: string;
		/** What follows the name in the heading: a link to the entry, "machine translation". */
		aside?: Snippet;
		/** undefined while looking up, null when there's nothing. */
		entries: Entry[] | null | undefined;
		/** Why the lookup failed, if it did. */
		failed?: string;
		/** What to say when there's nothing. */
		none: string;
		/** The Term's current Translations, so a meaning already added shows as such. */
		translations: string[];
		onadd: (meaning: string) => void;
	}

	let { name, label = name, aside, entries, failed, none, translations, onadd }: Props = $props();

	const added = (meaning: string) => translations.some((t) => t.toLocaleLowerCase() === meaning.toLocaleLowerCase());
</script>

<section class="dictionary" aria-label={label}>
	<h3>
		{name}
		{#if aside}<small>{@render aside()}</small>{/if}
	</h3>
	{#if failed}
		<p class="note">{failed}</p>
	{:else if entries === undefined}
		<p class="note">Looking up…</p>
	{:else if entries === null}
		<p class="note">{none}</p>
	{:else}
		{#each entries as entry, i (i)}
			{#if entry.partOfSpeech}<p class="part">{entry.partOfSpeech}</p>{/if}
			<ol>
				{#each entry.meanings as meaning, j (j)}
					<li>
						<button type="button" disabled={added(meaning)} onclick={() => onadd(meaning)} title="Add as a Translation"
							>{added(meaning) ? '✓' : '+'} {meaning}</button
						>
					</li>
				{/each}
			</ol>
		{/each}
	{/if}
</section>

<style>
	.dictionary {
		display: grid;
		gap: 0.25rem;
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	h3 small {
		font-weight: normal;
		margin-inline-start: 0.35rem;
		color: var(--muted);
	}
	.note {
		margin: 0;
	}
	.part {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		font-variant: small-caps;
		color: var(--muted);
	}
	ol {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	button {
		width: 100%;
		padding: 0.2rem 0.4rem;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		background: none;
		text-align: start;
		font: inherit;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	button:disabled {
		color: var(--ok);
		cursor: default;
	}
</style>
