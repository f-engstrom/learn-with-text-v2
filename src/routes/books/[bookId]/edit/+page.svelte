<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** What was sent if it was refused, else the Book as it is. */
	const values = $derived(form?.values ?? data.book);
</script>

<svelte:head>
	<title>Edit {data.book.title} · Reader</title>
</svelte:head>

<h1 dir="auto">{data.book.title}</h1>
<p class="lede">
	{data.book.pageCount}
	{data.book.pageCount === 1 ? 'Page' : 'Pages'} · <a href="/books/{data.book.id}">Open it</a>
</p>

<form method="POST" class="edit card">
	{#if form?.message}
		<p class="error" role="alert">{form.message}</p>
	{/if}

	<label>
		Title
		<input name="title" value={values.title} required dir="auto" />
	</label>

	<label>
		Language
		<select name="languageId" required>
			{#each data.languages as language (language.id)}
				<option value={language.id} selected={values.languageId === language.id}>{language.name}</option>
			{/each}
		</select>
	</label>

	<label>
		Text
		<textarea name="text" rows="20" value={values.text} dir="auto"></textarea>
	</label>
	<small>
		A line containing only <code>---</code> starts a new Page, and long Pages are split as when creating a Book. Add Pages at the end; Pages you
		leave as they are stay Read.
	</small>

	<div class="actions">
		<Button type="submit" variant="primary">Save</Button>
		<Button href="/">Cancel</Button>
	</div>
</form>

<style>
	.edit {
		display: grid;
		gap: 0.75rem;
		max-width: 48rem;
	}
	/* Let fields shrink below their natural width on a phone. */
	.edit > *,
	.edit label > * {
		min-width: 0;
	}
	.edit small {
		margin-top: -0.4rem;
	}
	.edit textarea {
		font-family: var(--font-text);
		font-size: 1.05rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		padding-top: 0.5rem;
	}
</style>
