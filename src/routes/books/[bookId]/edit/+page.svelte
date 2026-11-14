<!--
  A Book's edit screen: its title, Language and web address, then one card per Page to edit, move,
  join or remove, and a place between any two to add Pages. Saved at once by `editBook` (ADR 0008).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import { countWords, PageDraft } from '#lib/books/page-draft.svelte.ts';
	import { tick } from 'svelte';
	import AddPages from './AddPages.svelte';
	import PageCard from './PageCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	// The screen edits the Book as it was loaded; a refused Save keeps what you changed.
	// svelte-ignore state_referenced_locally
	const { book, languages } = data;
	const { bookmarkPageId } = book;
	const message = $derived(form?.message);

	const draft = new PageDraft(book.pages);
	let title = $state(book.title);
	let languageId = $state(book.languageId);
	let url = $state(book.url ?? '');
	/** Where the open Add Pages box is: after that Page's key, 'start', or null when none is open. */
	let addingAt = $state<string | null>(null);
	let saving = false;

	const language = $derived(languages.find((l) => l.id === languageId) ?? languages[0]);
	const wordsOf = (text: string) => countWords(text, language.code);
	const kept = $derived(draft.kept);
	const read = $derived(kept.filter((p) => p.readAt).length);
	const total = $derived(kept.reduce((n, p) => n + wordsOf(p.text), 0));
	const bookmarkPage = $derived(draft.pages.find((p) => p.id === bookmarkPageId));
	const bookmarkAt = $derived(bookmarkPage && draft.numberOf(bookmarkPage));
	const changed = $derived(draft.changed || title !== book.title || languageId !== book.languageId || url !== (book.url ?? ''));

	function goToBookmark() {
		if (!bookmarkPage) return;
		bookmarkPage.open = true;
		document.getElementById(`page-${bookmarkPage.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function add(text: string, after: (typeof draft.pages)[number] | null) {
		draft.addPages(text, after);
		addingAt = null;
	}

	let list: HTMLOListElement;

	/** Opens the Add Pages box after the last Page, from wherever you are. */
	async function addAtEnd() {
		addingAt = draft.pages.at(-1)?.key ?? 'start';
		await tick();
		list.querySelector('.add')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	/** Saves in place, so a refused Save keeps every change on the screen. */
	const save: Parameters<typeof enhance>[1] = () => {
		saving = true;
		return async ({ result, update }) => {
			if (result.type !== 'redirect') saving = false;
			await update({ reset: false });
		};
	};

	$effect(() => {
		if (!changed) return;
		const warn = (e: BeforeUnloadEvent) => {
			if (!saving) e.preventDefault();
		};
		addEventListener('beforeunload', warn);
		return () => removeEventListener('beforeunload', warn);
	});
</script>

<svelte:head>
	<title>Edit {book.title} · Reader</title>
</svelte:head>

<form method="POST" class="edit" use:enhance={save}>
	<h1 dir="auto">{title || book.title}</h1>
	<p class="lede">
		{kept.length}
		{kept.length === 1 ? 'Page' : 'Pages'} · {read} Read · about {total.toLocaleString('en')} Words ·
		<a href="/books/{book.id}">Open it</a>
	</p>

	{#if message}
		<p class="error" role="alert">{message}</p>
	{/if}

	<fieldset class="card fields">
		<label>
			Title
			<input name="title" bind:value={title} required dir="auto" />
		</label>
		<label>
			Language
			<select name="languageId" bind:value={languageId} required>
				{#each languages as l (l.id)}
					<option value={l.id}>{l.name}</option>
				{/each}
			</select>
		</label>
		<label class="url">
			Web address
			<input name="url" type="url" bind:value={url} placeholder="None: pasted text or a file" />
		</label>
		{#if languageId !== book.languageId}
			<p class="note">Its Pages will be split into Sentences and Words by {language.name}'s rules. Read marks stay.</p>
		{/if}
	</fieldset>

	<div class="pages-head">
		<h2>Pages</h2>
		{#if bookmarkAt}
			<Button variant="link" type="button" onclick={goToBookmark}>Bookmark on Page {bookmarkAt}</Button>
		{:else if bookmarkPage}
			<small>The Bookmark's Page is removed; it moves to the next Page.</small>
		{/if}
	</div>

	<ol class="pages" bind:this={list}>
		<AddPages
			where="before Page 1"
			lang={language.code}
			open={addingAt === 'start'}
			onopen={() => (addingAt = 'start')}
			onclose={() => (addingAt = null)}
			onadd={(text) => add(text, null)}
		/>
		{#each draft.pages as page, i (page.key)}
			{@const number = draft.numberOf(page)}
			<PageCard
				{page}
				bind:text={page.text}
				{number}
				words={wordsOf(page.text)}
				bookmark={page.id === bookmarkPageId}
				first={number === 1}
				last={number === kept.length}
				lang={language.code}
				rtl={language.rightToLeft}
				onmove={(by) => draft.move(page, by)}
				onremove={() => draft.remove(page)}
				onrestore={() => draft.restore(page)}
				onunmark={() => draft.unmarkRead(page)}
				onjoin={() => draft.joinWithNext(page)}
			/>
			<AddPages
				where={number ? `after Page ${number}` : `where Page ${page.was} was`}
				shown={i === draft.pages.length - 1}
				lang={language.code}
				open={addingAt === page.key}
				onopen={() => (addingAt = page.key)}
				onclose={() => (addingAt = null)}
				onadd={(text) => add(text, page)}
			/>
		{/each}
	</ol>

	<input type="hidden" name="pages" value={JSON.stringify(draft.toJSON())} />

	<div class="actions">
		<Button type="submit" variant="primary">Save</Button>
		<Button href="/">Cancel</Button>
		<Button type="button" onclick={addAtEnd}>+ Page at the end</Button>
		{#if changed}<small>Unsaved changes</small>{/if}
	</div>
</form>

<style>
	.edit {
		display: grid;
		gap: 0.75rem;
		max-width: 48rem;
	}
	.edit > *,
	.edit label > * {
		min-width: 0;
	}
	h1,
	.lede {
		margin-bottom: 0;
	}
	.lede {
		margin-top: -0.5rem;
		color: var(--muted);
	}
	.fields {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 0.75rem;
		margin: 0;
	}
	.fields label {
		display: grid;
		gap: 0.25rem;
	}
	.fields .url,
	.fields .note {
		grid-column: 1 / -1;
	}
	.note {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.pages-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.pages-head h2 {
		margin-bottom: 0;
	}
	.pages {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
	}
	.actions {
		position: sticky;
		bottom: 0;
		/* Over the Add Pages lines, which sit above the cards. */
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--border);
		background: var(--bg);
	}
	@media (max-width: 40rem) {
		.fields {
			grid-template-columns: 1fr;
		}
	}
</style>
