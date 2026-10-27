<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>New Book · Reader</title>
</svelte:head>

<p><a href="/">← Books</a></p>
<h1>New Book</h1>

<form method="POST" class="new-book" enctype="multipart/form-data">
	{#if form?.message}
		<p class="error" role="alert">{form.message}</p>
	{/if}

	<label>
		Language
		<select name="languageId" required>
			{#each data.languages as language (language.id)}
				<option value={language.id} selected={form?.values.languageId === language.id}>{language.name}</option>
			{/each}
		</select>
	</label>

	<label>
		Title
		<input name="title" value={form?.values.title ?? ''} />
	</label>
	<small>Leave it empty to use the file's name.</small>

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
</style>
