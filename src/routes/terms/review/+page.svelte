<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { actionUrl } from '#lib/actions.ts';
	import { dueLabel, holdsLabel, levelLabels } from '#lib/practice.ts';
	import type { Grade } from '#lib/server/domain/practice.ts';
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
		const lower = data.example.text.toLocaleLowerCase();
		const at = lower.indexOf(data.term.text.toLocaleLowerCase());
		if (at < 0) return { before: data.example.text, word: '', after: '' };
		const end = at + data.term.text.length;
		return { before: data.example.text.slice(0, at), word: data.example.text.slice(at, end), after: data.example.text.slice(end) };
	});

	async function grade(value: Grade) {
		if (!data.term || grading) return;
		grading = true;
		try {
			const body = new FormData();
			body.set('termId', String(data.term.id));
			body.set('grade', value);
			body.set('source', 'list');
			const response = await fetch(actionUrl('review', page.url.search), { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
			const result = deserialize(await response.text());
			error = result.type === 'failure' ? String(result.data?.message) : undefined;
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

<header class="page-header">
	<h1>Review</h1>
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
</header>
<p class="lede">
	{data.remaining} Due {data.remaining === 1 ? 'Term' : 'Terms'}{#if reviewed > 0}, {reviewed} reviewed this time{/if}.
	<a href="/terms?due=due{data.languageId ? `&language=${data.languageId}` : ''}">See them in the list</a>
</p>

{#if error}<p class="error" role="alert">{error}</p>{/if}

{#if !data.term}
	<div class="card done">
		<p>Nothing is Due. Read on, and Words come back here when it's time.</p>
		<a class="button" href="/">Back to your Books</a>
	</div>
{:else}
	{@const term = data.term}
	<article class="card review">
		<p class="meta">
			<span class="tag">{term.language.name}</span>
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
			<button type="button" class="primary" onclick={() => (revealed = true)}><kbd>Space</kbd> Reveal</button>
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
					<p class="muted">Recall: {levelLabels[term.practice.recall.level]} ({holdsLabel(term.practice.recall)})</p>
				{/if}
			</div>
			<div class="grades" role="group" aria-label="How did it go?">
				<button type="button" onclick={() => grade('missed')}><kbd>1</kbd> Missed</button>
				<button type="button" onclick={() => grade('hard')}><kbd>2</kbd> Hard</button>
				<button type="button" onclick={() => grade('got')}><kbd>3</kbd> Got it</button>
			</div>
		{/if}
	</article>
{/if}

<style>
	.review {
		display: grid;
		gap: 1rem;
		justify-items: start;
		max-width: 44rem;
	}
	.review p,
	.done p {
		margin: 0;
	}
	.done {
		display: grid;
		gap: 1rem;
		justify-items: start;
		max-width: 44rem;
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
		padding-inline-start: 1rem;
		border-inline-start: 3px solid var(--border);
		font-family: var(--font-text);
		font-size: 1.35rem;
		line-height: 1.7;
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
	.grades {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
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
