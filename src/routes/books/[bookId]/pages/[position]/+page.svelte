<script lang="ts">
	import type { PageProps } from './$types';
	import TermForm from './TermForm.svelte';

	let { data, form }: PageProps = $props();

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
			{#key `${selected.key}:${JSON.stringify(term)}`}
				<TermForm language={data.language} text={selected.text} {term} error={form?.message} />
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
	.close {
		justify-self: end;
	}
	@media (max-width: 50rem) {
		.reader {
			grid-template-columns: 1fr;
		}
	}
</style>
