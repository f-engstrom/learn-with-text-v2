<script lang="ts">
	import Button from './Button.svelte';
	import Tag from './Tag.svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { actionUrl } from '#lib/actions.ts';
	import type { Language } from '#lib/server/domain/languages.ts';
	import type { Source, TermView } from '#lib/server/domain/terms.ts';
	import { sourceLabels } from '#lib/terms.ts';
	import { termFields } from '#lib/term-writes.ts';

	interface Props {
		language: Language;
		/** The Word as clicked, used when there is no Term yet. */
		text: string;
		term: TermView | undefined;
		error: string | undefined;
	}

	let { language, text, term, error }: Props = $props();

	const statusButtonLabels = {
		learning1: '1',
		learning2: '2',
		learning3: '3',
		learning4: '4',
		known: 'Known',
		ignored: 'Ignored'
	} as const;


	interface Row {
		id?: number;
		text: string;
		source: Source;
	}

	// The parent re-creates this component whenever the Term changes, so copying it once is enough.
	const initial = () => term?.translations.map((t): Row => ({ ...t })) ?? [];
	let rows = $state<Row[]>(initial());
	if (rows.length === 0) rows.push({ text: '', source: 'you' });

	let dir: 'rtl' | 'ltr' = $derived(language.rightToLeft ? 'rtl' : 'ltr');
	const saved = () => ({ parent: term?.parent?.text ?? '', followsParent: term?.followsParent ?? false });
	let parent = $state(saved().parent);
	let followsParent = $state(saved().followsParent);

	let formElement: HTMLFormElement;
	let clipboardError = $state<string | undefined>();

	/** Reads the clipboard (the browser may ask for permission) and pastes it as a Translation. */
	export async function pasteFromClipboard() {
		let text: string;
		try {
			text = await navigator.clipboard.readText();
		} catch {
			clipboardError = "Couldn't read the clipboard. Press ⌘V (Ctrl+V) on the Page instead, or allow clipboard access.";
			return;
		}
		await pasteText(text);
	}

	/** Adds `copied` as a Translation and saves, keeping anything else you changed here. */
	export async function pasteText(copied: string) {
		const text = copied.trim().replace(/\s+/gu, ' ');
		if (text === '') {
			clipboardError = 'The clipboard is empty.';
			return;
		}
		clipboardError = undefined;
		await addTranslation(text, 'you');
	}

	/**
	 * Adds a Translation (into the first empty row) and saves, keeping anything else you changed
	 * here. A Translation the Term already has isn't added twice.
	 */
	export async function addTranslation(text: string, source: Source) {
		if (!rows.some((r) => r.text.trim().toLocaleLowerCase() === text.toLocaleLowerCase())) {
			const empty = rows.find((r) => r.text.trim() === '');
			if (empty) Object.assign(empty, { text, source });
			else rows.push({ text, source });
		}
		await tick();
		formElement.requestSubmit();
	}

	/** A Translation box grows to show all of a long Translation instead of cutting it off. */
	function grow(node: HTMLTextAreaElement, _text: string) {
		const fit = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		fit();
		return { update: fit };
	}

	/** Enter saves, as it did when Translations were one-line inputs; a Translation stays one line. */
	function saveOnEnter(e: KeyboardEvent) {
		if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
		e.preventDefault();
		formElement?.requestSubmit();
	}

	function move(from: number, to: number) {
		const [row] = rows.splice(from, 1);
		rows.splice(to, 0, row);
	}
</script>

<header class="heading">
	<h2 lang={language.code} {dir}>{term?.text ?? text}</h2>
	<Tag>{term ? 'Term' : 'Unknown'}</Tag>
	{#if term?.pronunciation}
		<p class="pronunciation">{term.pronunciation}</p>
	{/if}
</header>

<form method="POST" action={actionUrl('saveTerm', page.url.search)} use:enhance bind:this={formElement}>
	<input type="hidden" name={termFields.languageId} value={language.id} />
	<input type="hidden" name={termFields.text} value={term?.text ?? text} />

	<fieldset class="statuses">
		<legend>Status</legend>
		{#each Object.entries(statusButtonLabels) as [value, label] (value)}
			<label class="status-option status-{value}">
				<input type="radio" name={termFields.status} {value} checked={(term?.status ?? 'learning1') === value} />
				{label}
			</label>
		{/each}
	</fieldset>

	<fieldset class="translations">
		<legend>Translations</legend>
		<ol>
			{#each rows as row, i (row)}
				<li>
					<input type="hidden" name={termFields.translationId} value={row.id ?? ''} />
					<input type="hidden" name={termFields.translationSource} value={row.source} />
					<textarea
						name={termFields.translationText}
						rows="1"
						bind:value={row.text}
						use:grow={row.text}
						oninput={() => (row.source = 'you')}
						onkeydown={saveOnEnter}
						aria-label="Translation {i + 1}"
						autocomplete="off"
					></textarea>
					{#if row.source !== 'you'}<small class="source">{sourceLabels[row.source]}</small>{/if}
					<Button type="button" aria-label="Move up" disabled={i === 0} onclick={() => move(i, i - 1)}>↑</Button>
					<Button type="button" aria-label="Move down" disabled={i === rows.length - 1} onclick={() => move(i, i + 1)}
						>↓</Button
					>
					<Button type="button" aria-label="Remove" onclick={() => rows.splice(i, 1)}>✕</Button>
				</li>
			{/each}
		</ol>
		<div class="row-actions">
			<Button type="button" onclick={() => rows.push({ text: '', source: 'you' })}>Add Translation</Button>
			<Button type="button" onclick={pasteFromClipboard} title="Adds the copied text and saves (key: P)">Paste as Translation</Button>
		</div>
		{#if clipboardError}
			<p class="error" role="alert">{clipboardError}</p>
		{/if}
	</fieldset>

	<label>
		Pronunciation
		<input
			name={termFields.pronunciation}
			value={term?.pronunciation ?? ''}
			placeholder={language.code === 'zh' && !term ? 'Pinyin is filled in when you save' : ''}
			autocomplete="off"
		/>
	</label>

	<label>
		Parent
		<input name={termFields.parent} bind:value={parent} lang={language.code} {dir} placeholder="e.g. its dictionary form" autocomplete="off" />
	</label>
	{#if term?.parent && term.parent.text === parent.trim()}
		<p class="parent-status"><small>Parent's Status: {statusButtonLabels[term.parent.status]}</small></p>
	{/if}
	<label class="follows">
		<input type="checkbox" name={termFields.followsParent} bind:checked={followsParent} disabled={parent.trim() === ''} />
		Follows Parent (shares its Status)
	</label>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	<div class="form-actions">
		<Button type="submit" variant="primary">Save</Button>
		<!-- Submits the delete form below; forms can't nest, but their buttons can share a row. -->
		{#if term}<Button type="submit" form="delete-term-{term.id}" variant="danger">Delete Term</Button>{/if}
	</div>
</form>

{#if term}
	<form id="delete-term-{term.id}" method="POST" action={actionUrl('deleteTerm', page.url.search)} use:enhance hidden>
		<input type="hidden" name={termFields.id} value={term.id} />
	</form>
{/if}

<style>
	.heading {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.6rem;
		/* Clear of the panel's close button. */
		padding-inline-end: 2.5rem;
	}
	h2 {
		margin: 0;
	}
	.pronunciation {
		flex-basis: 100%;
		margin: 0;
		font-size: 1.1rem;
		color: var(--muted);
	}
	form {
		display: grid;
		gap: 0.75rem;
	}
	form[hidden] {
		display: none;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
		/* Browsers give a fieldset its content's width as a minimum; let it shrink to the panel. */
		min-width: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 0.4rem;
	}
	/*
	 * One joined bar of segments, each in its Status colour; the chosen one is ringed in ink.
	 * The radios stay in the form and take the keys, hidden behind their labels.
	 */
	.statuses {
		display: flex;
	}
	.status-option {
		position: relative;
		/* Each segment as wide as its label and the rest shared, so Known and Ignored fit a narrow panel. */
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 0.45rem;
		background: var(--status, var(--surface));
		border: 1px solid var(--text);
		border-inline-start-width: 0;
		cursor: pointer;
		text-align: center;
	}
	.status-option:first-of-type {
		border-inline-start-width: 1px;
		border-start-start-radius: 0.6rem;
		border-end-start-radius: 0.6rem;
	}
	.status-option:last-of-type {
		border-start-end-radius: 0.6rem;
		border-end-end-radius: 0.6rem;
	}
	.status-option input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.status-option:has(input:checked) {
		box-shadow: inset 0 0 0 2px var(--text);
		font-weight: 600;
	}
	.status-option:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		z-index: 1;
	}
	.translations ol {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.35rem;
		margin: 0 0 0.5rem;
		padding-inline-start: 1.25rem;
	}
	/*
	 * The text box takes the room the buttons leave and wraps a long Translation; its Source sits
	 * under it, so the box keeps that room in a narrow column and on a phone.
	 */
	.translations li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) repeat(3, auto);
		gap: 0.25rem;
		align-items: start;
	}
	.translations li textarea {
		grid-area: 1 / 1;
		min-width: 0;
		resize: none;
		overflow: hidden;
		line-height: 1.4;
	}
	.translations li .source {
		grid-area: 2 / 1;
		justify-self: start;
		margin-top: -0.1rem;
		font-size: 0.8rem;
	}
	.translations li :global(button) {
		grid-row: 1;
		padding-inline: 0.55rem;
	}
	.source {
		padding: 0 0.3rem;
		border-radius: 0.25rem;
		background: var(--surface-2);
	}
	.error {
		color: var(--danger);
	}
	.follows {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.parent-status {
		margin: -0.5rem 0 0;
		color: var(--muted);
	}
	.form-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.row-actions :global(button) {
		white-space: nowrap;
	}
</style>
