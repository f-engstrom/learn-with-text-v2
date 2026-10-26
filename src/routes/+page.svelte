<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Reader</title>
</svelte:head>

<h1>Reader</h1>

<h2>Books</h2>
<p><a href="/books/new">New Book</a></p>
{#if data.books.length === 0}
	<p>No Books yet.</p>
{:else}
	<ul>
		{#each data.books as book (book.id)}
			<li><a href="/books/{book.id}/pages/1">{book.title}</a> <small>({book.languageName})</small></li>
		{/each}
	</ul>
{/if}

<h2>Languages</h2>
<ul>
	{#each data.languages as language (language.id)}
		<li>
			{language.name}
			<small>({language.code}{language.rightToLeft ? ', right to left' : ''})</small>
		</li>
	{/each}
</ul>
