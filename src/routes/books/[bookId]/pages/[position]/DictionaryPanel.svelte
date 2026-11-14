<!--
	The Dictionary panel, at the bottom of the Term panel: a tab for each Dictionary, at most one open.
	Wiktionary and Azure suggest meanings to add as Translations, Wiktionary with the Language's
	Wiktionary page beneath when it has one configured; any other configured Dictionary shows its page
	for the selected Word or phrase, or opens it in a window. Choosing the open tab closes it, and with
	none open nothing is looked up.
-->
<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { lookupUrl, type Dictionary } from '#lib/dictionaries.ts';
	import type { DictionaryTab } from '#lib/reading/open-dictionary.svelte.ts';
	import type { Language } from '#lib/server/domain/languages.ts';
	import type { OriginSuggestion } from '#lib/server/domain/etymology.ts';
	import type { Origin } from '#lib/server/domain/terms.ts';
	import Suggestions from './Suggestions.svelte';

	interface Props {
		language: Language;
		/** The selected Word or phrase: its Normalised form and its text as written. */
		termKey: string;
		text: string;
		/** The Term's current Translations, so a meaning already added shows as such. */
		translations: string[];
		/** The Language's configured Dictionaries, but for its Wiktionary page. */
		dictionaries: Dictionary[];
		/** The Language's Wiktionary page, shown beneath Wiktionary's suggestions. */
		wiktionaryPage: Dictionary | null;
		/** Whether Azure Translator has its key; without one its tab only says how to set it up. */
		azureReady: boolean;
		/** The open tab; none when the panel is closed. */
		open: DictionaryTab | null;
		onchoose: (tab: DictionaryTab) => void;
		onadd: (meaning: string, source: 'wiktionary' | 'azure') => void;
		/** The Term's own Origin, so Wiktionary's Etymology in use shows as such. */
		origin?: Origin;
		/** The names of Your languages, marked in an Origin. */
		yourLanguages?: string[];
		/** Takes one of Wiktionary's Etymologies as the Origin; none where the Origin isn't the Term's own. */
		onuseorigin?: (origin: OriginSuggestion) => void;
	}

	let {
		language,
		termKey,
		text,
		translations,
		dictionaries,
		wiktionaryPage,
		azureReady,
		open,
		onchoose,
		onadd,
		origin,
		yourLanguages,
		onuseorigin
	}: Props = $props();

	let embedded = $derived(dictionaries.filter((d) => d.display === 'embedded'));
	let popups = $derived(dictionaries.filter((d) => d.display === 'popup'));
	let shown = $derived(typeof open === 'number' ? embedded.find((d) => d.id === open) : undefined);

	function openPopup(dictionary: Dictionary) {
		window.open(lookupUrl(dictionary, termKey), 'dictionary', 'popup,width=760,height=820');
	}
</script>

<section class="dictionary-panel">
	<div class="tabs" role="group" aria-label="Dictionaries">
		<Button type="button" pressed={open === 'wiktionary'} onclick={() => onchoose('wiktionary')}>Wiktionary</Button>
		<Button
			type="button"
			class={azureReady ? undefined : 'unready'}
			title={azureReady ? undefined : 'Not set up'}
			pressed={open === 'azure'}
			onclick={() => onchoose('azure')}>Azure</Button
		>
		{#each embedded as dictionary (dictionary.id)}
			<Button type="button" pressed={open === dictionary.id} onclick={() => onchoose(dictionary.id)}>{dictionary.name}</Button>
		{/each}
		{#each popups as dictionary (dictionary.id)}
			<Button type="button" variant="quiet" title="Opens in a new window" onclick={() => openPopup(dictionary)}>{dictionary.name} ↗</Button>
		{/each}
	</div>
	{#snippet page(dictionary: Dictionary)}
		<!-- Sandboxed so a dictionary site can't navigate the reading screen away. -->
		<iframe
			title="{dictionary.name}: {termKey}"
			src={lookupUrl(dictionary, termKey)}
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
			referrerpolicy="no-referrer"
		></iframe>
	{/snippet}
	{#if open === 'wiktionary'}
		<Suggestions
			source="wiktionary"
			{language}
			{termKey}
			{text}
			{translations}
			linked={!wiktionaryPage}
			onadd={(meaning) => onadd(meaning, 'wiktionary')}
			{origin}
			{yourLanguages}
			{onuseorigin}
		/>
		{#if wiktionaryPage}{@render page(wiktionaryPage)}{/if}
	{:else if open === 'azure' && !azureReady}
		<p class="note">
			Azure Translator isn’t set up: add <code>AZURE_TRANSLATOR_KEY</code> and <code>AZURE_TRANSLATOR_REGION</code> to <code>.env</code> and restart.
		</p>
	{:else if open === 'azure'}
		<Suggestions source="azure" {language} {termKey} {text} {translations} onadd={(meaning) => onadd(meaning, 'azure')} />
	{:else if shown}
		{@render page(shown)}
	{/if}
</section>

<style>
	.dictionary-panel {
		display: grid;
		gap: 0.6rem;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.tabs :global(button) {
		padding-block: 0.2rem;
		font-size: 0.9rem;
	}
	/* Azure without its key: there, but not in reach. */
	.tabs :global(.unready:not([aria-pressed='true'])) {
		color: var(--muted);
		border-style: dashed;
	}
	.note {
		margin: 0;
		font-size: 0.9rem;
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
