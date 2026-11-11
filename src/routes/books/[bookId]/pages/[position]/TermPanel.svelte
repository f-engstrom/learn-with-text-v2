<!-- Beside the text when a Word, phrase or Character part is selected: its Term form, what is known about the Term, practice, and the dictionaries. -->
<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import CloseButton from '#lib/components/CloseButton.svelte';
	import TermForm from '#lib/components/TermForm.svelte';
	import type { Dictionary } from '#lib/dictionaries.ts';
	import { termKey } from '#lib/normalise.ts';
	import { frequencyLabels, suggestedStatus, transferLabel } from '#lib/practice.ts';
	import type { Selected } from '#lib/reading/selection.svelte.ts';
	import type { FrequencyBand } from '#lib/server/domain/frequency.ts';
	import type { Language } from '#lib/server/domain/languages.ts';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import type { Status, TermView } from '#lib/server/domain/terms.ts';
	import { statusLabels } from '#lib/terms.ts';
	import Dictionaries from './Dictionaries.svelte';
	import PracticeCard from './PracticeCard.svelte';
	import DictionaryPanel from './DictionaryPanel.svelte';

	interface Props {
		language: Language;
		selected: Selected;
		/** The selected Word's or phrase's Term; none if it is Unknown. */
		term: TermView | undefined;
		/** Its Frequency band, for a Word in a Language with a list. */
		band: FrequencyBand | undefined;
		/** For a Word of several characters: the Word as written, its characters, and which are picked (first and last, by index). */
		parts: { word: { key: string; text: string }; characters: string[]; picked: readonly [number, number] | undefined } | undefined;
		statusOf: (key: string) => Status | 'unknown';
		dictionaries: Dictionary[];
		/** The open Dictionary tab, kept while you move between Words. */
		dictionary: number | undefined;
		/** Why the last save was refused. */
		error: string | undefined;
		onclose: () => void;
		onwholeword: () => void;
		onpickcharacter: (index: number, shift: boolean) => void;
		onstatus: (status: Status) => void;
		onreview: (termId: number, grade: Grade) => void;
	}

	let {
		language,
		selected,
		term,
		band,
		parts,
		statusOf,
		dictionaries,
		dictionary = $bindable(),
		error,
		onclose,
		onwholeword,
		onpickcharacter,
		onstatus,
		onreview
	}: Props = $props();

	let termForm = $state<ReturnType<typeof TermForm>>();
	/** A Status the Tutor's assessment and Recall strength agree on, if it isn't yours. */
	let suggestion = $derived(term && suggestedStatus(term.status, term.tutorAssessment, term.practice));
	let translations = $derived(term?.translations.map((t) => t.text) ?? []);

	/** Reads the clipboard and pastes it as a Translation. */
	export function pasteFromClipboard() {
		return termForm?.pasteFromClipboard();
	}

	/** Adds `copied` as a Translation and saves. */
	export function pasteText(copied: string) {
		return termForm?.pasteText(copied);
	}
</script>

<div class="term-panel card">
	<CloseButton label="Close the Term form" onclick={onclose} />
	{#if parts}
		<div class="parts" role="group" aria-label="The whole Word or some of its characters">
			<button type="button" class="part status-{statusOf(parts.word.key)}" aria-pressed={!parts.picked} onclick={onwholeword}
				>{parts.word.text}</button
			>
			{#each parts.characters as character, i (i)}
				<button
					type="button"
					class="part status-{statusOf(termKey(character, language))}"
					aria-pressed={parts.picked !== undefined && i >= parts.picked[0] && i <= parts.picked[1]}
					onmousedown={(e) => e.shiftKey && e.preventDefault()}
					onclick={(e) => onpickcharacter(i, e.shiftKey)}>{character}</button
				>
			{/each}
		</div>
	{/if}
	{#key `${selected.key}:${JSON.stringify(term)}`}
		<TermForm bind:this={termForm} {language} text={selected.text} {term} {error} />
	{/key}
	{#if band || term?.transfer || term?.tutorAssessment}
		<dl class="facts">
			{#if band}<dt>Frequency</dt><dd>{frequencyLabels[band]}</dd>{/if}
			{#if term?.transfer}
				<dt>Transfer</dt>
				<dd>{transferLabel(term.transfer)}{#if term.transfer.reason}<small>{term.transfer.reason}</small>{/if}</dd>
			{/if}
			{#if term?.tutorAssessment}<dt>Tutor</dt><dd>{statusLabels[term.tutorAssessment]}</dd>{/if}
		</dl>
	{/if}
	{#if term && suggestion}
		<p class="suggestion">
			{suggestion.from} to <strong>{statusLabels[suggestion.level]}</strong>; your Status is {statusLabels[term.status]}.
			<Button type="button" onclick={() => onstatus(suggestion.level)}>Set {statusLabels[suggestion.level]}</Button>
		</p>
	{/if}
	{#if term?.practice}
		<PracticeCard {term} onreview={(grade) => onreview(term.id, grade)} />
	{/if}
	<DictionaryPanel
		source="wiktionary"
		{language}
		termKey={selected.key}
		text={selected.text}
		{translations}
		onadd={(definition) => termForm?.addTranslation(definition, 'wiktionary')}
	/>
	<DictionaryPanel
		source="azure"
		{language}
		termKey={selected.key}
		text={selected.text}
		{translations}
		onadd={(translation) => termForm?.addTranslation(translation, 'azure')}
	/>
	<Dictionaries {dictionaries} term={selected.key} bind:chosen={dictionary} />
</div>

<style>
	.term-panel {
		position: relative;
		/*
		 * Taller than the window with a Dictionary open: the column beside the text scrolls it, so Save
		 * can stick to its bottom. It keeps its content's height there; shrunk to the column, the card
		 * would end while its form ran on below it.
		 */
		flex-shrink: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		box-sizing: border-box;
	}
	/* Save and Delete stay in reach at the bottom of the scrolling panel while the form is in view. */
	.term-panel :global(.form-actions) {
		position: sticky;
		bottom: 0;
		z-index: 1;
		margin-inline: -0.5rem;
		padding: 0.6rem 0.5rem;
		background: var(--surface);
		box-shadow: 0 -10px 12px -10px color-mix(in srgb, var(--text) 25%, transparent);
	}
	/* Leaves room for the close button. */
	.parts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-inline-end: 2.5rem;
	}
	/* Filled with its Status colour (--status, from app.css). */
	.part {
		background: var(--status, transparent);
		padding: 0.15rem 0.5rem;
		font-size: 1.15rem;
	}
	.part:first-child {
		margin-inline-end: 0.5rem;
	}
	.part[aria-pressed='true'] {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.75rem;
		margin: 0;
		font-size: 0.9rem;
	}
	.facts dt {
		color: var(--muted);
	}
	.facts dd {
		margin: 0;
	}
	.facts small {
		display: block;
		color: var(--muted);
	}
	.suggestion {
		margin: 0;
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius);
		background: var(--accent-soft);
		font-size: 0.9rem;
	}
	.suggestion :global(button) {
		margin-top: 0.4rem;
		padding-block: 0.2rem;
		font-size: 0.85rem;
	}
	@media (max-width: 60rem) {
		/* One column: the Term panel is a sheet over the bottom of the screen, not below the whole Page. */
		.term-panel {
			position: fixed;
			inset-inline: 0;
			bottom: 0;
			z-index: 3;
			max-height: 62vh;
			gap: 0.75rem;
			padding: 1rem;
			/* On a phone the sheet itself scrolls. */
			overflow-y: auto;
			overflow-x: hidden;
			overscroll-behavior: contain;
			border-end-start-radius: 0;
			border-end-end-radius: 0;
			box-shadow: 0 -8px 30px rgb(0 0 0 / 0.18);
		}
	}
</style>
