<script lang="ts">
	import type { AzureResult } from '#lib/server/domain/azure.ts';
	import type { Language } from '#lib/server/domain/languages.ts';

	interface Props {
		language: Language;
		/** The selected Word or phrase: its Normalised form and its text as written. */
		termKey: string;
		text: string;
		/** The Term's current Translations, so a translation already added shows as such. */
		translations: string[];
		onadd: (translation: string) => void;
	}

	let { language, termKey, text, translations, onadd }: Props = $props();

	let result = $state<AzureResult | null | undefined>();
	let failed = $state<string | undefined>();
	const added = (translation: string) => translations.some((t) => t.toLocaleLowerCase() === translation.toLocaleLowerCase());

	$effect(() => {
		const params = new URLSearchParams({ language: String(language.id), key: termKey, text });
		const controller = new AbortController();
		result = undefined;
		failed = undefined;
		fetch(`/api/azure?${params}`, { signal: controller.signal })
			.then(async (response) => {
				if (response.status === 503) throw new Error('Azure Translator isn’t set up.');
				if (!response.ok) throw new Error('Couldn’t reach Azure Translator.');
				result = await response.json();
			})
			.catch((e) => {
				if (!controller.signal.aborted) failed = e.message;
			});
		return () => controller.abort();
	});
</script>

<section class="azure" aria-label="Azure Translator">
	<h3>
		Azure
		{#if result?.kind === 'translation'}<small>machine translation</small>{/if}
	</h3>
	{#if failed}
		<p class="note">{failed}</p>
	{:else if result === undefined}
		<p class="note">Looking up…</p>
	{:else if result === null}
		<p class="note">No translation.</p>
	{:else}
		{#each result.entries as entry, i (i)}
			{#if entry.partOfSpeech}<p class="part">{entry.partOfSpeech}</p>{/if}
			<ol>
				{#each entry.translations as translation, j (j)}
					<li>
						<button type="button" disabled={added(translation)} onclick={() => onadd(translation)} title="Add as a Translation"
							>{added(translation) ? '✓' : '+'} {translation}</button
						>
					</li>
				{/each}
			</ol>
		{/each}
	{/if}
</section>

<style>
	.azure {
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
