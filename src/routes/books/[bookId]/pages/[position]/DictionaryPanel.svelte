<!--
	A Dictionary panel beside the text: the Wiktionary panel (definitions) or the Azure panel (Azure Translator).
	It looks the selected Word or phrase up, then shows "Looking up…", why it failed, that there's nothing,
	or its entries, each meaning a button that adds it as a Translation from that Source.
-->
<script lang="ts">
	import type { AzureResult } from '#lib/server/domain/azure.ts';
	import type { Language } from '#lib/server/domain/languages.ts';
	import type { WiktionaryResult } from '#lib/server/domain/wiktionary.ts';

	interface Props {
		/** Which dictionary it asks, and the Source its Translations get. */
		source: 'wiktionary' | 'azure';
		language: Language;
		/** The selected Word or phrase: its Normalised form and its text as written. */
		termKey: string;
		text: string;
		/** The Term's current Translations, so a meaning already added shows as such. */
		translations: string[];
		onadd: (meaning: string) => void;
	}

	let { source, language, termKey, text, translations, onadd }: Props = $props();

	/** One part of speech and its meanings, each a possible Translation. */
	type Entry = { partOfSpeech?: string; meanings: string[] };
	type Result = { source: 'wiktionary'; answer: WiktionaryResult } | { source: 'azure'; answer: AzureResult };

	let result = $state<Result | null | undefined>();
	let failed = $state<string | undefined>();
	let dir: 'rtl' | 'ltr' = $derived(language.rightToLeft ? 'rtl' : 'ltr');

	let entries: Entry[] | null | undefined = $derived(
		result &&
			(result.source === 'wiktionary'
				? result.answer.entries.map((e) => ({ partOfSpeech: e.partOfSpeech, meanings: e.definitions }))
				: result.answer.entries.map((e) => ({ partOfSpeech: e.partOfSpeech || undefined, meanings: e.translations })))
	);

	/** Why a lookup failed, in the panel's words. */
	function failure(status: number) {
		if (source === 'wiktionary') return "Couldn't reach Wiktionary.";
		return status === 503 ? 'Azure Translator isn’t set up.' : 'Couldn’t reach Azure Translator.';
	}

	$effect(() => {
		const asked = source;
		const params = new URLSearchParams({ language: String(language.id), key: termKey, text });
		const controller = new AbortController();
		result = undefined;
		failed = undefined;
		fetch(`/api/${asked}?${params}`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw failure(response.status);
				const answer = await response.json();
				result = answer === null ? null : ({ source: asked, answer } as Result);
			})
			.catch((e) => {
				// A failure of its own is its message; anything else is a lookup that never got through.
				if (!controller.signal.aborted) failed = typeof e === 'string' ? e : failure(0);
			});
		return () => controller.abort();
	});

	const added = (meaning: string) => translations.some((t) => t.toLocaleLowerCase() === meaning.toLocaleLowerCase());
</script>

<section class="dictionary" aria-label={source === 'wiktionary' ? 'Wiktionary' : 'Azure Translator'}>
	<h3>
		{source === 'wiktionary' ? 'Wiktionary' : 'Azure'}
		{#if result?.source === 'wiktionary'}
			<small
				><a href="https://en.wiktionary.org/wiki/{encodeURIComponent(result.answer.title.replaceAll(' ', '_'))}" target="_blank" rel="noreferrer"
					><span lang={language.code} {dir}>{result.answer.title}</span> ↗</a
				></small
			>
		{:else if result?.source === 'azure' && result.answer.kind === 'translation'}
			<small>machine translation</small>
		{/if}
	</h3>
	{#if failed}
		<p class="note">{failed}</p>
	{:else if entries === undefined}
		<p class="note">Looking up…</p>
	{:else if entries === null}
		<p class="note">{source === 'wiktionary' ? `No ${language.name} entry.` : 'No translation.'}</p>
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
