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

{#if data.latest || data.due > 0}
	<div class="now">
		{#if data.latest}
			{@const book = data.books.find((b) => b.id === data.latest?.bookId)}
			<a class="card continue" href="/books/{data.latest.bookId}">
				<span class="label">Continue</span>
				<strong dir="auto">{data.latest.title}</strong>
				<span class="muted">
					{[`Page ${data.latest.bookmark.page}${book ? ` of ${book.pageCount}` : ''}`, data.latest.bookmark.word && `at ${data.latest.bookmark.word}`]
						.filter(Boolean)
						.join(' · ')}
				</span>
			</a>
		{/if}
		{#if data.due > 0}
			<a class="card due" href="/terms/review">
				<span class="label">Practice</span>
				<strong>{data.due} Due {data.due === 1 ? 'Term' : 'Terms'}</strong>
				<span class="muted">Review them, or press R while reading</span>
			</a>
		{/if}
	</div>
{/if}

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
						<td class="title">
							<a href="/books/{book.id}" dir="auto">{book.title}</a>
							<!-- On a phone the other columns fold into this line. -->
							<small class="meta">
								{book.languageName} · Page {book.bookmark.page} of {book.pageCount} · {percent.format(book.unknownShare)} Unknown
							</small>
						</td>
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
	.now {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.now .card {
		display: grid;
		gap: 0.2rem;
		color: var(--text);
		text-decoration: none;
	}
	.now .card:hover {
		border-color: var(--accent);
	}
	.now strong {
		font-size: 1.15rem;
	}
	.now .label {
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.now .due {
		border-inline-start: 4px solid var(--due-2);
	}
	.now .continue {
		border-inline-start: 4px solid var(--accent);
	}
	.find {
		margin-bottom: 2rem;
	}
	.meta {
		display: none;
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
	/* A phone: one line per Book, its details folded under the title, no sideways scroll. */
	@media (max-width: 40rem) {
		thead,
		td:not(.title) {
			display: none;
		}
		.meta {
			display: block;
			margin-top: 0.15rem;
			color: var(--muted);
		}
	}
</style>
