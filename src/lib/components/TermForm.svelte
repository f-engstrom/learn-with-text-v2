<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { actionUrl } from '#lib/actions.ts';
	import type { Language } from '#lib/server/domain/languages.ts';
	import type { Source, TermView } from '#lib/server/domain/terms.ts';

	interface Props {
		language: Language;
		/** The Word as clicked, used when there is no Term yet. */
		text: string;
		term: TermView | undefined;
		error: string | undefined;
	}

	let { language, text, term, error }: Props = $props();

	const statusLabels = {
		learning1: '1',
		learning2: '2',
		learning3: '3',
		learning4: '4',
		known: 'Known',
		ignored: 'Ignored'
	} as const;

	const sourceLabels: Record<Source, string> = { you: '', wiktionary: 'Wiktionary', tutor: 'Tutor' };

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

	function move(from: number, to: number) {
		const [row] = rows.splice(from, 1);
		rows.splice(to, 0, row);
	}
</script>

<h2 lang={language.code} {dir}>{term?.text ?? text}</h2>
{#if term?.pronunciation}
	<p class="pronunciation">{term.pronunciation}</p>
{/if}
<p><small>{term ? 'Term' : 'Unknown'}</small></p>

<form method="POST" action={actionUrl('saveTerm', page.url.search)} use:enhance bind:this={formElement}>
	<input type="hidden" name="languageId" value={language.id} />
	<input type="hidden" name="text" value={term?.text ?? text} />

	<fieldset class="statuses">
		<legend>Status</legend>
		{#each Object.entries(statusLabels) as [value, label] (value)}
			<label class="status-option {value}">
				<input type="radio" name="status" {value} checked={(term?.status ?? 'learning1') === value} />
				{label}
			</label>
		{/each}
	</fieldset>

	<fieldset class="translations">
		<legend>Translations</legend>
		<ol>
			{#each rows as row, i (row)}
				<li>
					<input type="hidden" name="translationId" value={row.id ?? ''} />
					<input type="hidden" name="translationSource" value={row.source} />
					<input
						name="translationText"
						bind:value={row.text}
						oninput={() => (row.source = 'you')}
						aria-label="Translation {i + 1}"
						autocomplete="off"
					/>
					{#if sourceLabels[row.source]}<small class="source">{sourceLabels[row.source]}</small>{/if}
					<button type="button" aria-label="Move up" disabled={i === 0} onclick={() => move(i, i - 1)}>↑</button>
					<button type="button" aria-label="Move down" disabled={i === rows.length - 1} onclick={() => move(i, i + 1)}
						>↓</button
					>
					<button type="button" aria-label="Remove" onclick={() => rows.splice(i, 1)}>✕</button>
				</li>
			{/each}
		</ol>
		<div class="row-actions">
			<button type="button" onclick={() => rows.push({ text: '', source: 'you' })}>Add Translation</button>
			<button type="button" onclick={pasteFromClipboard} title="Adds the copied text and saves (key: P)">Paste as Translation</button>
		</div>
		{#if clipboardError}
			<p class="error" role="alert">{clipboardError}</p>
		{/if}
	</fieldset>

	<label>
		Pronunciation
		<input
			name="pronunciation"
			value={term?.pronunciation ?? ''}
			placeholder={language.code === 'zh' && !term ? 'Pinyin is filled in when you save' : ''}
			autocomplete="off"
		/>
	</label>

	<label>
		Parent
		<input name="parent" bind:value={parent} lang={language.code} {dir} placeholder="e.g. its dictionary form" autocomplete="off" />
	</label>
	{#if term?.parent && term.parent.text === parent.trim()}
		<p class="parent-status"><small>Parent's Status: {statusLabels[term.parent.status]}</small></p>
	{/if}
	<label class="follows">
		<input type="checkbox" name="followsParent" bind:checked={followsParent} disabled={parent.trim() === ''} />
		Follows Parent (shares its Status)
	</label>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	<button type="submit">Save</button>
</form>

{#if term}
	<form method="POST" action={actionUrl('deleteTerm', page.url.search)} use:enhance>
		<input type="hidden" name="id" value={term.id} />
		<button type="submit" class="delete">Delete Term</button>
	</form>
{/if}

<style>
	h2 {
		margin: 0;
	}
	.pronunciation {
		margin: 0;
		font-size: 1.1rem;
		color: #555;
	}
	form {
		display: grid;
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 0.25rem;
	}
	.statuses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.status-option {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.4rem;
		border-radius: 0.25rem;
	}
	.status-option.learning1 {
		background: #f8b7a0;
	}
	.status-option.learning2 {
		background: #f9cf9d;
	}
	.status-option.learning3 {
		background: #f6e3a1;
	}
	.status-option.learning4 {
		background: #e3ecb3;
	}
	.status-option.known,
	.status-option.ignored {
		border: 1px solid #ccc;
	}
	.translations ol {
		display: grid;
		gap: 0.35rem;
		margin: 0 0 0.5rem;
		padding-inline-start: 1.5rem;
	}
	.translations li {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}
	.translations li input[name='translationText'] {
		width: 9rem;
	}
	.source {
		padding: 0 0.3rem;
		border-radius: 0.25rem;
		background: #eee;
	}
	.error {
		color: #b00020;
	}
	.follows {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.parent-status {
		margin: -0.5rem 0 0;
		color: #555;
	}
	.delete {
		justify-self: start;
	}
	.row-actions {
		display: flex;
		gap: 0.35rem;
	}
</style>
