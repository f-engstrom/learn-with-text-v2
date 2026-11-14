<!--
  The Book's Chapters in the reading screen (ADR 0009): which one this Page is in and where in it,
  opening to the list of them, each a link to its first Page with how many of its Pages are Read.
  Nothing shows for a Book with no Chapters.
-->
<script lang="ts">
	import type { Chapter, ChapterPlace } from '#lib/server/domain/chapters.ts';

	interface Props {
		bookId: number;
		chapters: Chapter[];
		/** Where this Page is; undefined before the first Chapter. */
		here?: ChapterPlace;
		lang?: string;
		dir?: 'rtl' | 'ltr' | 'auto';
	}

	let { bookId, chapters, here, lang, dir = 'auto' }: Props = $props();
	let details = $state<HTMLDetailsElement>();

	/** Closes on Escape or a click outside, as a menu does. */
	function close(e: Event) {
		if (!details?.open) return;
		if (e instanceof KeyboardEvent ? e.key === 'Escape' : !details.contains(e.target as Node)) details.open = false;
	}
</script>

<svelte:window onkeydown={close} onpointerdown={close} />

{#if chapters.length > 0}
	<details class="contents" bind:this={details}>
		<summary title="Chapters">
			{#if here}
				<span class="label" {lang} {dir}>{here.label}</span>
				<span class="where">{here.page}/{here.pages}</span>
			{:else}
				<span class="label">Before Chapter 1</span>
			{/if}
		</summary>
		<ol>
			{#each chapters as chapter (chapter.number)}
				{@const pages = chapter.last - chapter.first + 1}
				<li class:here={chapter.number === here?.number}>
					<a href="/books/{bookId}/pages/{chapter.first}" aria-current={chapter.number === here?.number ? 'location' : undefined}>
						<span class="number">{chapter.number}</span>
						<span class="title" {lang} {dir}>{chapter.label}</span>
						<span class={['read', { done: chapter.read === pages }]}>{chapter.read}/{pages}</span>
					</a>
				</li>
			{/each}
		</ol>
	</details>
{/if}

<style>
	.contents {
		position: relative;
		min-width: 0;
	}
	summary {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		max-width: 100%;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--text);
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '▾';
		color: var(--muted);
		font-size: 0.8em;
	}
	summary:hover {
		background: var(--surface-2);
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-text);
	}
	.where {
		color: var(--muted);
		font-size: 0.85em;
		font-variant-numeric: tabular-nums;
	}
	ol {
		position: absolute;
		z-index: 5;
		top: calc(100% + 0.25rem);
		left: 50%;
		translate: -50% 0;
		width: min(24rem, calc(100vw - 2rem));
		max-height: min(60vh, 28rem);
		overflow-y: auto;
		margin: 0;
		padding: 0.35rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-lifted);
		list-style: none;
	}
	a {
		display: grid;
		grid-template-columns: 1.8rem 1fr auto;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem;
		border-radius: var(--radius);
		color: var(--text);
		text-decoration: none;
	}
	a:hover {
		background: var(--surface-2);
	}
	.here a {
		background: var(--accent-soft);
	}
	.number {
		color: var(--muted);
		text-align: end;
		font-variant-numeric: tabular-nums;
	}
	.title {
		font-family: var(--font-text);
	}
	.read {
		color: var(--muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}
	.read.done {
		color: var(--ok);
	}
</style>
