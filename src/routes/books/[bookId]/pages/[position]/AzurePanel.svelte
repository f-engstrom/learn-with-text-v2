<script lang="ts">
	import DictionaryEntries from './DictionaryEntries.svelte';
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

<DictionaryEntries
	name="Azure"
	label="Azure Translator"
	entries={result && result.entries.map((e) => ({ partOfSpeech: e.partOfSpeech, meanings: e.translations }))}
	{failed}
	none="No translation."
	{translations}
	{onadd}
>
	{#snippet aside()}
		{#if result?.kind === 'translation'}machine translation{/if}
	{/snippet}
</DictionaryEntries>
