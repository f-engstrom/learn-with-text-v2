<script lang="ts">
	import type { Language } from '#lib/server/domain/languages.ts';
	import type { WiktionaryResult } from '#lib/server/domain/wiktionary.ts';

	interface Props {
		language: Language;
		/** The selected Word or phrase: its Normalised form and its text as written. */
		termKey: string;
		text: string;
		/** The Term's current Translations, so a definition already added shows as such. */
		translations: string[];
		onadd: (definition: string) => void;
	}

	let { language, termKey, text, translations, onadd }: Props = $props();

	let result = $state<WiktionaryResult | null | undefined>();
	let failed = $state(false);
	let dir: 'rtl' | 'ltr' = $derived(language.rightToLeft ? 'rtl' : 'ltr');
	const added = (definition: string) => translations.some((t) => t.toLocaleLowerCase() === definition.toLocaleLowerCase());

	$effect(() => {
		const params = new URLSearchParams({ language: String(language.id), key: termKey, text });
		const controller = new AbortController();
		result = undefined;
		failed = false;
		fetch(`/api/wiktionary?${params}`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(String(response.status));
				result = await response.json();
			})
			.catch(() => {
				if (!controller.signal.aborted) failed = true;
			});
		return () => controller.abort();
	});
</script>

<section class="wiktionary" aria-label="Wiktionary">
	<h3>
		Wiktionary
		{#if result}
			<small
				><a href="https://en.wiktionary.org/wiki/{encodeURIComponent(result.title.replaceAll(' ', '_'))}" target="_blank" rel="noreferrer"
					><span lang={language.code} {dir}>{result.title}</span> ↗</a
				></small
			>
		{/if}
	</h3>
	{#if failed}
		<p class="note">Couldn't reach Wiktionary.</p>
	{:else if result === undefined}
		<p class="note">Looking up…</p>
	{:else if result === null}
		<p class="note">No {language.name} entry.</p>
	{:else}
		{#each result.entries as entry, i (i)}
			<p class="part">{entry.partOfSpeech}</p>
			<ol>
				{#each entry.definitions as definition, j (j)}
					<li>
						<button type="button" disabled={added(definition)} onclick={() => onadd(definition)} title="Add as a Translation"
							>{added(definition) ? '✓' : '+'} {definition}</button
						>
					</li>
				{/each}
			</ol>
		{/each}
	{/if}
</section>

<style>
	.wiktionary {
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
	}
	.note {
		margin: 0;
		color: var(--muted);
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
