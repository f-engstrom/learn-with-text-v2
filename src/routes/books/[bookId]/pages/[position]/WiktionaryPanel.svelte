<script lang="ts">
	import DictionaryEntries from './DictionaryEntries.svelte';
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
	let failed = $state<string | undefined>();
	let dir: 'rtl' | 'ltr' = $derived(language.rightToLeft ? 'rtl' : 'ltr');

	$effect(() => {
		const params = new URLSearchParams({ language: String(language.id), key: termKey, text });
		const controller = new AbortController();
		result = undefined;
		failed = undefined;
		fetch(`/api/wiktionary?${params}`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(String(response.status));
				result = await response.json();
			})
			.catch(() => {
				if (!controller.signal.aborted) failed = "Couldn't reach Wiktionary.";
			});
		return () => controller.abort();
	});
</script>

<DictionaryEntries
	name="Wiktionary"
	entries={result && result.entries.map((e) => ({ partOfSpeech: e.partOfSpeech, meanings: e.definitions }))}
	{failed}
	none="No {language.name} entry."
	{translations}
	{onadd}
>
	{#snippet aside()}
		{#if result}
			<a href="https://en.wiktionary.org/wiki/{encodeURIComponent(result.title.replaceAll(' ', '_'))}" target="_blank" rel="noreferrer"
				><span lang={language.code} {dir}>{result.title}</span> ↗</a
			>
		{/if}
	{/snippet}
</DictionaryEntries>
