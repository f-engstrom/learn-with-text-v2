<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import RecogniseFiles from '#lib/components/RecogniseFiles.svelte';
	import { appendRecognised } from '#lib/recognise.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The form is posted without JavaScript's help, so a refused one comes back as a new page.
	// svelte-ignore state_referenced_locally
	let languageId = $state(form?.values.languageId || data.languages[0]?.id);
	// svelte-ignore state_referenced_locally
	let title = $state(form?.values.title ?? '');
	// svelte-ignore state_referenced_locally
	let text = $state(form?.values.text ?? '');

	/** A file's text goes into the box to check; the first one names the Book unless you have. */
	function read(more: string, file: File) {
		if (text.trim() === '' && title.trim() === '') title = file.name.replace(/\.[^.]+$/, '');
		text = appendRecognised(text, more);
	}
</script>

<svelte:head>
	<title>New Book · Reader</title>
</svelte:head>

<h1>New Book</h1>
<p class="lede">Paste a text, fetch an article from a web address, or read one from photos, a PDF or a text file.</p>

<form method="POST" action="?/create" class="new-book card">
	{#if form?.message}
		<p class="error" role="alert">
			{form.message}
			{#if form && 'existingId' in form}<a href="/books/{form.existingId}">Open it</a>{/if}
		</p>
	{/if}

	<label>
		Language
		<select name="languageId" bind:value={languageId} required>
			{#each data.languages as language (language.id)}
				<option value={language.id}>{language.name}</option>
			{/each}
		</select>
	</label>

	<div class="address">
		<label>
			Web address
			<input name="url" type="url" placeholder="https://…" value={form?.values.url ?? ''} autocomplete="off" />
		</label>
		<Button formaction="?/fetch" formnovalidate>Fetch article</Button>
	</div>
	{#if form && 'fetched' in form}
		<small class="fetched">Fetched. Check the title and text, edit anything you like, then create the Book.</small>
	{:else}
		<small>Fetches the article's text into the form, without the site's menus, ads and footers.</small>
	{/if}

	<label>
		Title
		<input name="title" bind:value={title} />
	</label>
	<small>Leave it empty to use the article's headline.</small>

	{#snippet textBox()}
		<label>
			Text
			<textarea name="text" rows="16" bind:value={text}></textarea>
		</label>
	{/snippet}
	<div class="read">
		<span>Or read the text from photos, a PDF or a text file</span>
		<small>Each is read into the text below as it comes, to check against the photo before you create the Book.</small>
		{#if languageId}
			<RecogniseFiles {languageId} onread={read}>{@render textBox()}</RecogniseFiles>
		{:else}
			{@render textBox()}
		{/if}
	</div>
	<small
		>A line containing only <code>---</code> starts a new Page, and one starting <code># </code> starts a Chapter. Headings like “Chapter 3” are found by themselves.</small
	>

	<div class="actions">
		<Button type="submit" variant="primary">Create Book</Button>
	</div>
</form>

<style>
	.new-book {
		display: grid;
		gap: 0.75rem;
		max-width: 48rem;
	}
	/* Let fields shrink below their natural width on a phone. */
	.new-book > *,
	.new-book label > * {
		min-width: 0;
	}
	.new-book small {
		margin-top: -0.4rem;
	}
	.new-book textarea {
		font-family: var(--font-text);
		font-size: 1.05rem;
	}
	.actions {
		padding-top: 0.5rem;
	}
	.address {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: end;
	}
	.read {
		display: grid;
		gap: 0.4rem;
	}
	.read > small {
		margin-top: -0.2rem;
	}
	/* A photo opened to check the text against takes the screen's width, beside the text. */
	@media (min-width: 60rem) {
		.new-book:has(:global(.comparing)) {
			max-width: none;
		}
		.new-book:has(:global(.comparing)) > :not(.read) {
			max-width: 46rem;
		}
	}
	.fetched {
		color: var(--ok);
	}
</style>
