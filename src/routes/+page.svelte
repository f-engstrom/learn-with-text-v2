<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
</script>

<svelte:head>
	<title>Reader</title>
</svelte:head>

<div class="page-header">
	<h1>Books</h1>
	<a class="button primary" href="/books/new">New Book</a>
</div>

<section class="find card" aria-labelledby="find-heading">
	<h2 id="find-heading">Find something to read</h2>
	<div class="languages">
		{#each data.languages as language (language.id)}
			<a class="button" href="/languages/{language.id}/suggestions">{language.name}</a>
		{/each}
	</div>
	<p class="note">Wikipedia articles on your <a href="/topics">Topics</a> and the latest from your <a href="/feeds">Feeds</a>, ranked by how well they fit.</p>
</section>

{#if data.books.length === 0}
	<p class="note">No Books yet. Create one, or find something to read above.</p>
{:else}
	<div class="table-wrap">
		<table class="data">
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
						<td class="title"><a href="/books/{book.id}" dir="auto">{book.title}</a></td>
						<td>{book.languageName}</td>
						<td class="number">
							{book.pageCount}
							{#if book.readCount > 0}<small>· {book.readCount} Read</small>{/if}
						</td>
						<td>Page {book.bookmark.page}</td>
						<td class="number" title="Share of the Book's distinct Words that are Unknown">
							<span class="share">
								<span class="bar" aria-hidden="true"><span style:width="{Math.round(book.unknownShare * 100)}%"></span></span>
								{percent.format(book.unknownShare)}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.find {
		margin-bottom: 2rem;
	}
	.find h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
	}
	.languages {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.find .note {
		margin: 0.75rem 0 0;
		font-size: 0.9rem;
	}
	.title a {
		font-weight: 500;
		text-decoration: none;
	}
	.title a:hover {
		text-decoration: underline;
	}
	.share {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
	}
	.bar {
		display: inline-block;
		width: 4rem;
		height: 0.35rem;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		opacity: 0.6;
	}
	@media (max-width: 40rem) {
		.bar {
			display: none;
		}
	}
</style>
