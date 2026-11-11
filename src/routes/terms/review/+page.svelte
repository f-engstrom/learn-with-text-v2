<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Grades from '#lib/components/Grades.svelte';
	import { invalidateAll } from '$app/navigation';
	import { statusLabels } from '#lib/terms.ts';
	import { dueLabel, holdsLabel, wordAt } from '#lib/practice.ts';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import { sendReview } from '#lib/reviews.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let revealed = $state(false);
	let reviewed = $state(0);
	let error = $state<string | undefined>();
	/** While a Review is saving, so a quick second key can't grade the same Term twice. */
	let grading = false;
	// Each new Term starts hidden.
	$effect(() => {
		data.term?.id;
		revealed = false;
	});
	let dir: 'rtl' | 'ltr' = $derived(data.term?.language.rightToLeft ? 'rtl' : 'ltr');

	/** The example Sentence split around the Term (as written, in any case), to bold it. */
	let parts = $derived.by(() => {
		if (!data.term || !data.example) return undefined;
		const at = wordAt(data.example.text, data.term.text);
		if (at < 0) return { before: data.example.text, word: '', after: '' };
		const end = at + data.term.text.length;
		return { before: data.example.text.slice(0, at), word: data.example.text.slice(at, end), after: data.example.text.slice(end) };
	});

	async function grade(value: Grade) {
		if (!data.term || grading) return;
		grading = true;
		try {
			error = await sendReview(data.term.id, value, 'list');
			if (!error) reviewed++;
			await invalidateAll();
		} finally {
			grading = false;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (!data.term || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, button, a')) return;
		if (!revealed && (e.code === 'Space' || e.code === 'Enter')) {
			e.preventDefault();
			revealed = true;
			return;
		}
		const digit = /^(?:Digit|Numpad)([1-3])$/.exec(e.code)?.[1];
		if (revealed && digit) {
			e.preventDefault();
			grade((['missed', 'hard', 'got'] as const)[Number(digit) - 1]);
		}
	}
</script>

<svelte:window {onkeydown} />

<svelte:head>
	<title>Review · Reader</title>
</svelte:head>

<PageHeader title="Review">
	<form method="GET" class="language">
		<label>
			<span class="visually-hidden">Language</span>
			<select name="language" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="">All Languages</option>
				{#each data.languages as language (language.id)}
					<option value={language.id} selected={data.languageId === language.id}>{language.name}</option>
				{/each}
			</select>
		</label>
	</form>
	{#snippet lede()}
	{data.remaining} Due {data.remaining === 1 ? 'Term' : 'Terms'}{#if reviewed > 0}, {reviewed} reviewed this time{/if}.
	<a href="/terms?due=due{data.languageId ? `&language=${data.languageId}` : ''}">See them in the list</a>
	{/snippet}
</PageHeader>

{#if error}<p class="error" role="alert">{error}</p>{/if}

{#if !data.term}
	<div class="card done">
		<p>Nothing is Due. Read on, and Words come back here when it's time.</p>
		<Button href="/">Back to your Books</Button>
	</div>
{:else}
	{@const term = data.term}
	<article class="card review">
		<p class="meta">
			<Tag>{term.language.name}</Tag>
			{#if term.practice}<span class="due due-{term.practice.overdue}">{dueLabel(term.practice)}</span>{/if}
		</p>
		{#if parts && data.example}
			<blockquote class="example" lang={term.language.code} {dir}>
				{parts.before}<strong>{parts.word}</strong>{parts.after}
			</blockquote>
			<p class="source">
				<a href="/books/{data.example.bookId}/pages/{data.example.page}">{data.example.title}, Page {data.example.page}</a>
			</p>
		{:else}
			<p class="word" lang={term.language.code} {dir}>{term.text}</p>
		{/if}

		{#if !revealed}
			<Button type="button" variant="primary" key="Space" onclick={() => (revealed = true)}>Reveal</Button>
		{:else}
			<div class="answer">
				<p class="word" lang={term.language.code} {dir}>
					{term.text}
					{#if term.pronunciation}<small>{term.pronunciation}</small>{/if}
				</p>
				{#if term.translations.length > 0}
					<ul>
						{#each term.translations as translation (translation.id)}<li>{translation.text}</li>{/each}
					</ul>
				{:else}
					<p class="muted">No Translations yet.</p>
				{/if}
				{#if term.parent}<p class="muted">From <span lang={term.language.code}>{term.parent.text}</span></p>{/if}
				{#if term.practice?.recall}
					<p class="muted">Recall: {statusLabels[term.practice.recall.level]} ({holdsLabel(term.practice.recall)})</p>
				{/if}
			</div>
			<Grades ongrade={grade} keys />
		{/if}
	</article>
{/if}

<style>
	/* One card in the middle of the page, like a page of a book. */
	.review {
		display: grid;
		gap: 1.1rem;
		justify-items: start;
		max-width: 40rem;
		margin-inline: auto;
		padding: 2rem 2.25rem;
	}
	.review p,
	.done p {
		margin: 0;
	}
	.done {
		display: grid;
		gap: 1rem;
		justify-items: start;
		max-width: 40rem;
		margin-inline: auto;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		font-size: 0.9rem;
	}
	.example {
		margin: 0;
		padding-inline-start: 1.1rem;
		border-inline-start: 3px solid var(--border);
		font-family: var(--font-text);
		font-size: 1.5rem;
		line-height: 1.65;
	}
	.example strong {
		background: var(--accent-soft);
		border-radius: 0.25em;
		padding: 0 0.1em;
	}
	.source {
		font-size: 0.9rem;
	}
	.word {
		font-family: var(--font-text);
		font-size: 1.6rem;
	}
	.word small {
		margin-inline-start: 0.5rem;
		color: var(--muted);
		font-family: var(--font-ui);
		font-size: 1rem;
	}
	.answer {
		display: grid;
		gap: 0.4rem;
	}
	.answer ul {
		margin: 0;
		padding-inline-start: 1.2rem;
		font-size: 1.1rem;
	}
	.due-1 {
		color: var(--due-1-text);
	}
	.due-2 {
		color: var(--due-2-text);
	}
	.due-3 {
		color: var(--due-3-text);
		font-weight: 600;
	}
</style>
