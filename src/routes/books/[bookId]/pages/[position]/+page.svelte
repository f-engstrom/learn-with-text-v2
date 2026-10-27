<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick, untrack } from 'svelte';
	import { moveCursor } from '#lib/reading/cursor.ts';
	import { commandFor } from '#lib/reading/keys.ts';
	import type { ReadingToken } from '#lib/server/domain/books.ts';
	import type { Status } from '#lib/server/domain/terms.ts';
	import type { PageProps } from './$types';
	import TermForm from './TermForm.svelte';

	type Word = ReadingToken & { key: string; index: number; sentence: number };

	let { data, form }: PageProps = $props();

	let words = $derived(
		data.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t): t is Word => t.key !== undefined)))
	);
	/** The Word the keyboard is on, by index; the Term form shows it while `open`. */
	let current = $state<number | undefined>();
	let open = $state(false);
	let selected = $derived(current === undefined ? undefined : words[current]);
	let term = $derived(selected && data.terms[selected.key]);
	/** Statuses set by keyboard that the server hasn't confirmed yet, so the colour changes at once. */
	let pending = $state<Record<string, Status>>({});
	let error = $state<string | undefined>();
	let wordElements = $state<HTMLElement[]>([]);
	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');

	const statusOf = (key: string) => pending[key] ?? data.terms[key]?.status ?? 'unknown';

	let pageKey = $derived(`${data.book.id}/${data.position}`);
	/** The Sentence (1-based) on this Page the Bookmark was last saved at; 0 when it is on another Page. */
	let bookmarked = 0;

	// Opening a Page moves the Bookmark here; on the bookmarked Page the cursor resumes at its Sentence.
	$effect(() => {
		pageKey;
		untrack(enterPage);
	});

	// Moving the cursor into another Sentence moves the Bookmark with it.
	$effect(() => {
		if (selected) saveBookmark(selected.sentence + 1);
	});

	function enterPage() {
		open = false;
		error = undefined;
		const { bookmark } = data.book;
		bookmarked = bookmark.page === data.position ? bookmark.sentence : 0;
		const sentence = Math.max(bookmarked, 1);
		const first = sentence > 1 ? words.find((w) => w.sentence === sentence - 1) : undefined;
		current = first?.index;
		saveBookmark(sentence);
		if (first) tick().then(() => wordElements[first.index]?.scrollIntoView({ block: 'center' }));
	}

	function saveBookmark(sentence: number) {
		if (sentence === bookmarked) return;
		bookmarked = sentence;
		const body = new FormData();
		body.set('sentence', String(sentence));
		fetch('?/bookmark', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
	}

	async function goTo(index: number | undefined) {
		current = index;
		await tick();
		if (index !== undefined) wordElements[index]?.focus();
	}

	async function setStatus(word: Word, status: Status) {
		pending[word.key] = status;
		const body = new FormData();
		body.set('languageId', String(data.language.id));
		body.set('text', word.text);
		body.set('status', status);
		const response = await fetch('?/setStatus', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await response.text());
		error = result.type === 'failure' ? String(result.data?.message) : undefined;
		await invalidateAll();
		delete pending[word.key];
	}

	/** Buttons and links handle Enter themselves. */
	function isControl(target: EventTarget | null) {
		return target instanceof HTMLElement && target.closest('button, a, summary') !== null;
	}

	function isTyping(target: EventTarget | null) {
		return (
			target instanceof HTMLElement &&
			(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
		);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.defaultPrevented) return;
		const command = commandFor(e, data.language.rightToLeft);
		// While typing in the Term form, only Escape (close) applies.
		if (!command || (isTyping(e.target) && command.kind !== 'close')) return;
		if (command.kind === 'open' && isControl(e.target)) return;
		e.preventDefault();
		switch (command.kind) {
			case 'move':
			case 'sentence':
				goTo(moveCursor(words, current, command));
				break;
			case 'status':
				if (selected) setStatus(selected, command.status);
				break;
			case 'open':
				if (selected) open = true;
				break;
			case 'close':
				open = false;
				goTo(current);
				break;
		}
	}

	function choose(word: Word) {
		current = word.index;
		open = true;
	}
</script>

<svelte:window {onkeydown} />

<svelte:head>
	<title>{data.book.title} · Reader</title>
</svelte:head>

<p><a href="/">← Books</a></p>
<h1 lang={data.language.code} {dir}>{data.book.title}</h1>
{#snippet pages()}
	<nav class="pages">
		{#if data.position > 1}
			<a href="/books/{data.book.id}/pages/{data.position - 1}">← Previous</a>
		{/if}
		<small>Page {data.position} of {data.book.pageCount}{data.read ? ' · Read' : ''}</small>
		{#if data.position < data.book.pageCount}
			<a href="/books/{data.book.id}/pages/{data.position + 1}">Next →</a>
		{/if}
	</nav>
{/snippet}
{@render pages()}
<p class="keys">
	<small
		><kbd>←</kbd> <kbd>→</kbd> Word · <kbd>↑</kbd> <kbd>↓</kbd> Sentence · <kbd>1</kbd>–<kbd>4</kbd> Learning ·
		<kbd>K</kbd> Known · <kbd>I</kbd> Ignored · <kbd>Enter</kbd> Term form · <kbd>Esc</kbd> close</small
	>
</p>
{#if error}
	<p class="error" role="alert">{error}</p>
{/if}

<div class="reader">
	<article class="page" lang={data.language.code} {dir}>
		{#each data.paragraphs as paragraph, p (p)}
			<p>
				{#each paragraph.sentences as sentence, s (s)}
					<span class="sentence">
						{#each sentence.tokens as token, t (t)}
							{#if token.key !== undefined && token.index !== undefined}{@const word = token as Word}<span
									role="button"
									tabindex={word.index === (current ?? 0) ? 0 : -1}
									class="word {statusOf(word.key)}"
									class:current={current === word.index}
									bind:this={wordElements[word.index]}
									onclick={() => choose(word)}
									onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose(word))}
									>{word.text}</span
								>{:else}{token.text}{/if}
						{/each}
					</span>
				{/each}
			</p>
		{/each}
		<form method="POST" action="?/markRead" class="mark-read" use:enhance>
			<button>Mark as read</button>
			<button name="restKnown" value="true">Mark as read, rest Known</button>
		</form>
		{@render pages()}
	</article>

	{#if open && selected}
		<aside class="term-panel">
			{#key `${selected.key}:${JSON.stringify(term)}`}
				<TermForm language={data.language} text={selected.text} {term} error={form?.message} />
			{/key}
			<button type="button" class="close" onclick={() => (open = false)}>Close</button>
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
	.word:focus {
		outline: none;
	}
	.word.current {
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
	.pages {
		display: flex;
		gap: 1rem;
		align-items: baseline;
	}
	.mark-read {
		display: flex;
		gap: 0.5rem;
		margin-block: 1.5rem 0.5rem;
	}
	/* The Page text may be right to left; the controls stay left to right. */
	.page .pages,
	.mark-read {
		direction: ltr;
		font-size: 1rem;
	}
	.keys {
		color: #555;
	}
	kbd {
		padding: 0 0.3em;
		border: 1px solid #ccc;
		border-radius: 0.2em;
		font-size: 0.85em;
	}
	.error {
		color: #b00020;
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
