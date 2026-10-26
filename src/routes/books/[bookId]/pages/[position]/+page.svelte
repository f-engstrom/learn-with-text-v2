<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const statusLabels = {
		learning1: '1',
		learning2: '2',
		learning3: '3',
		learning4: '4',
		known: 'Known',
		ignored: 'Ignored'
	} as const;

	/** The Word whose Term form is open, by Normalised form, and its text as clicked. */
	let selected = $state<{ key: string; text: string } | undefined>();
	let term = $derived(selected && data.terms[selected.key]);
	function select(token: { key?: string; text: string }) {
		if (token.key) selected = { key: token.key, text: token.text };
	}

	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');
</script>

<svelte:head>
	<title>{data.book.title} · Reader</title>
</svelte:head>

<p><a href="/">← Books</a></p>
<h1 lang={data.language.code} {dir}>{data.book.title}</h1>
<p><small>Page {data.position} of {data.book.pageCount}</small></p>

<div class="reader">
	<article class="page" lang={data.language.code} {dir}>
		{#each data.paragraphs as paragraph, p (p)}
			<p>
				{#each paragraph.sentences as sentence, s (s)}
					<span class="sentence">
						{#each sentence.tokens as token, t (t)}
							{#if token.key}<span
									role="button"
									tabindex="0"
									class="word {data.terms[token.key]?.status ?? 'unknown'}"
									class:selected={selected?.key === token.key}
									onclick={() => select(token)}
									onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(token))}
									>{token.text}</span
								>{:else}{token.text}{/if}
						{/each}
					</span>
				{/each}
			</p>
		{/each}
	</article>

	{#if selected}
		<aside class="term-panel">
			{#key `${selected.key}:${term?.id}:${term?.status}:${term?.translation}`}
				<h2 lang={data.language.code} {dir}>{term?.text ?? selected.text}</h2>
				<p><small>{term ? 'Term' : 'Unknown'}</small></p>

				<form method="POST" action="?/saveTerm" use:enhance>
					<input type="hidden" name="languageId" value={data.language.id} />
					<input type="hidden" name="text" value={term?.text ?? selected.text} />

					<fieldset class="statuses">
						<legend>Status</legend>
						{#each Object.entries(statusLabels) as [value, label] (value)}
							<label class="status-option {value}">
								<input type="radio" name="status" {value} checked={(term?.status ?? 'learning1') === value} />
								{label}
							</label>
						{/each}
					</fieldset>

					<label>
						Translation
						<input name="translation" value={term?.translation ?? ''} autocomplete="off" />
					</label>

					{#if form?.message}
						<p class="error" role="alert">{form.message}</p>
					{/if}
					<button type="submit">Save</button>
				</form>

				{#if term}
					<form method="POST" action="?/deleteTerm" use:enhance>
						<input type="hidden" name="id" value={term.id} />
						<button type="submit" class="delete">Delete Term</button>
					</form>
				{/if}
			{/key}
			<button type="button" class="close" onclick={() => (selected = undefined)}>Close</button>
		</aside>
	{/if}
</div>

<style>
	.reader {
		display: grid;
		grid-template-columns: minmax(0, 48rem) minmax(16rem, 22rem);
		gap: 2rem;
		align-items: start;
	}
	.page {
		font-size: 1.25rem;
		line-height: 1.9;
	}
	/* Inline spans, not buttons: a button would let a line break before the punctuation after it. */
	.word {
		padding: 0 0.05em;
		border-radius: 0.2em;
		cursor: pointer;
	}
	.word.selected {
		outline: 2px solid #3366cc;
	}
	.unknown {
		background: #d6ebff;
	}
	.learning1 {
		background: #f8b7a0;
	}
	.learning2 {
		background: #f9cf9d;
	}
	.learning3 {
		background: #f6e3a1;
	}
	.learning4 {
		background: #e3ecb3;
	}
	.word.ignored {
		color: #777;
	}
	.term-panel {
		position: sticky;
		top: 1rem;
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
	}
	.term-panel h2 {
		margin: 0;
	}
	.term-panel form {
		display: grid;
		gap: 0.75rem;
	}
	.term-panel label {
		display: grid;
		gap: 0.25rem;
	}
	.statuses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		border: none;
		padding: 0;
	}
	.statuses legend {
		padding: 0;
		margin-bottom: 0.25rem;
	}
	.status-option {
		display: flex !important;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem 0.4rem;
		border-radius: 0.25rem;
	}
	.status-option.known,
	.status-option.ignored {
		border: 1px solid #ccc;
	}
	.error {
		color: #b00020;
	}
	.delete {
		justify-self: start;
	}
	.close {
		justify-self: end;
	}
	@media (max-width: 50rem) {
		.reader {
			grid-template-columns: 1fr;
		}
	}
</style>
