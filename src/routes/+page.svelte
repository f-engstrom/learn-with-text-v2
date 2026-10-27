<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
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
	<table class="books">
		<thead>
			<tr>
				<th scope="col">Title</th>
				<th scope="col">Language</th>
				<th scope="col" class="number">Pages</th>
				<th scope="col">Bookmark</th>
				<th scope="col" class="number">Unknown</th>
			</tr>
		</thead>
		<tbody>
			{#each data.books as book (book.id)}
				<tr>
					<td><a href="/books/{book.id}">{book.title}</a></td>
					<td>{book.languageName}</td>
					<td class="number">{book.pageCount}{#if book.readCount > 0}{' '}<small>({book.readCount} Read)</small>{/if}</td>
					<td>Page {book.bookmark.page}</td>
					<td class="number" title="Share of the Book's distinct Words that are Unknown">{percent.format(book.unknownShare)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
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

<style>
	.books {
		border-collapse: collapse;
		min-width: min(40rem, 100%);
	}
	.books th,
	.books td {
		padding: 0.35rem 0.75rem 0.35rem 0;
		border-bottom: 1px solid #e3e3e3;
		text-align: start;
	}
	.books .number {
		text-align: end;
		font-variant-numeric: tabular-nums;
	}
	.books small {
		color: #555;
	}
</style>
