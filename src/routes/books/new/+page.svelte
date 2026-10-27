<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>New Book · Reader</title>
</svelte:head>

<p><a href="/">← Books</a></p>
<h1>New Book</h1>

<form method="POST" action="?/create" class="new-book" enctype="multipart/form-data">
	{#if form?.message}
		<p class="error" role="alert">
			{form.message}
			{#if form && 'existingId' in form}<a href="/books/{form.existingId}">Open it</a>{/if}
		</p>
	{/if}

	<label>
		Language
		<select name="languageId" required>
			{#each data.languages as language (language.id)}
				<option value={language.id} selected={form?.values.languageId === language.id}>{language.name}</option>
			{/each}
		</select>
	</label>

	<div class="address">
		<label>
			Web address
			<input name="url" type="url" placeholder="https://…" value={form?.values.url ?? ''} autocomplete="off" />
		</label>
		<button formaction="?/fetch" formnovalidate>Fetch article</button>
	</div>
	{#if form && 'fetched' in form}
		<small class="fetched">Fetched. Check the title and text, edit anything you like, then create the Book.</small>
	{:else}
		<small>Fetches the article's text into the form, without the site's menus, ads and footers.</small>
	{/if}

	<label>
		Title
		<input name="title" value={form?.values.title ?? ''} />
	</label>
	<small>Leave it empty to use the article's headline or the file's name.</small>

	<label>
		Text
		<textarea name="text" rows="16" value={form?.values.text ?? ''}></textarea>
	</label>

	<label>
		Or a text file
		<input type="file" name="file" accept=".txt,text/plain" />
	</label>
	<small>UTF-8 text, up to 5 MB. A line containing only <code>---</code> starts a new Page.</small>

	<button type="submit">Create Book</button>
</form>

<style>
	.new-book {
		display: grid;
		gap: 0.75rem;
		max-width: 48rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	.error {
		color: #b00020;
	}
	.address {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: end;
	}
	.fetched {
		color: #2f7a3a;
	}
</style>
