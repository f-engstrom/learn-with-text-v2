<!--
  One Page in the edit screen: its number, whether it is Read, its Words, the Bookmark and the Chapter
  it starts, collapsed to its first lines until opened to edit its text, mark it as starting a Chapter,
  move it, join it, add after it or remove it.
-->
<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import type { DraftPage } from '#lib/books/page-draft.svelte.ts';
	import { LONG_PAGE_WORDS, splitAtBreaks } from '#lib/pages.ts';

	interface Props {
		page: DraftPage;
		text: string;
		/** Its number once saved; null when removed. */
		number: number | null;
		words: number;
		/** The number of the Chapter it starts; null when it starts none. */
		chapterNumber?: number | null;
		/** The Bookmark is on this Page. */
		bookmark?: boolean;
		first?: boolean;
		last?: boolean;
		lang?: string;
		rtl?: boolean;
		onmove?: (by: -1 | 1) => void;
		onremove?: () => void;
		onrestore?: () => void;
		onunmark?: () => void;
		onjoin?: () => void;
		onchapter?: (starts: boolean) => void;
	}

	let {
		page,
		text = $bindable(),
		number,
		words,
		chapterNumber = null,
		bookmark = false,
		first = false,
		last = false,
		lang,
		rtl = false,
		onmove,
		onremove,
		onrestore,
		onunmark,
		onjoin,
		onchapter
	}: Props = $props();

	const dir = $derived(rtl ? 'rtl' : 'auto');
	const parts = $derived(splitAtBreaks(text).length);
	const long = $derived(words > LONG_PAGE_WORDS);
	const preview = $derived(text.trim().slice(0, 240) || 'Empty');
	const readOn = $derived(page.readAt && new Date(page.readAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
	const moved = $derived(page.was !== null && number !== null && page.was !== number);
	const id = $derived(`page-${page.key}`);
</script>

{#if page.removed}
	<li class="card page removed" data-key={page.key}>
		<p>
			<s>Page {page.was ?? ''}</s> will be removed when you save.
			{#if page.readAt}It was Read: its {words.toLocaleString('en')} Words leave your Words read.{/if}
		</p>
		<Button variant="link" type="button" onclick={onrestore}>Undo</Button>
	</li>
{:else}
	<li class={['card page', { open: page.open, bookmark, chapter: chapterNumber !== null }]} data-key={page.key} {id}>
		{#if chapterNumber !== null}
			<p class="chapter-start">
				<span class="label">Chapter {chapterNumber}</span>
				{#if page.chapter}<span class="title" {lang} {dir}>{page.chapter}</span>{/if}
			</p>
		{/if}
		<header>
			<span class="number" aria-label="Page {number}">{number}</span>
			<button type="button" class="summary" aria-expanded={page.open} aria-controls="{id}-text" onclick={() => (page.open = !page.open)}>
				{#if !page.open}<span class="preview" class:empty={!text.trim()} {lang} {dir}>{preview}</span>{:else}<span class="editing"
						>Editing Page {number}</span
					>{/if}
			</button>
			<span class="move">
				<button type="button" class="quiet" aria-label="Move Page {number} up" disabled={first} onclick={() => onmove?.(-1)}>↑</button>
				<button type="button" class="quiet" aria-label="Move Page {number} down" disabled={last} onclick={() => onmove?.(1)}>↓</button>
			</span>
		</header>

		<p class="facts">
			{#if page.readAt}<Tag tone="ok">Read {readOn}</Tag>{/if}
			{#if bookmark}<Tag tone="accent">Bookmark</Tag>{/if}
			{#if page.id === null}<Tag>New</Tag>{/if}
			<small>{words.toLocaleString('en')} {words === 1 ? 'Word' : 'Words'}</small>
			{#if moved}<small>· was Page {page.was}</small>{/if}
		</p>

		{#if long}
			<p class="note warn">About {words.toLocaleString('en')} Words, longer than usual. A <code>---</code> line splits it.</p>
		{/if}
		{#if parts > 1}
			<p class="note">Becomes {parts} Pages when you save{page.readAt ? ', all Read' : ''}.</p>
		{/if}

		{#if page.open}
			<!-- svelte-ignore a11y_autofocus -->
			<textarea id="{id}-text" bind:value={text} {lang} {dir} aria-label="Text of Page {number}" autofocus={page.id === null}></textarea>
			<div class="chapter-fields">
				<label class="starts">
					<input type="checkbox" checked={page.chapter !== null} onchange={(e) => onchapter?.(e.currentTarget.checked)} />
					Starts a Chapter
				</label>
				{#if page.chapter !== null}
					<input
						class="title-field"
						bind:value={page.chapter}
						{lang}
						{dir}
						placeholder="Chapter {chapterNumber}"
						aria-label="Title of the Chapter Page {number} starts"
					/>
				{/if}
			</div>
			<div class="actions">
				<Button variant="quiet" type="button" onclick={onjoin} disabled={last}>Join with next</Button>
				{#if page.readAt}<Button variant="quiet" type="button" onclick={onunmark}>Not Read</Button>{/if}
				<Button variant="quiet" type="button" class="remove" onclick={onremove}>Remove</Button>
			</div>
		{/if}
	</li>
{/if}

<style>
	.page {
		display: grid;
		gap: 0.4rem;
		padding: 0.75rem 1rem;
		list-style: none;
	}
	.chapter-start {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0 0 0.1rem;
		padding-inline-start: 2.55rem;
	}
	.chapter-start .label {
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.chapter-start .title {
		font-family: var(--font-text);
		font-weight: 600;
	}
	.page.chapter {
		border-top: 3px solid color-mix(in srgb, var(--accent) 55%, var(--border));
	}
	.chapter-fields {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	.starts {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.title-field {
		flex: 1 1 14rem;
		min-width: 0;
		font-family: var(--font-text);
	}
	.page.bookmark {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}
	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: 0.75rem;
	}
	.number {
		min-width: 1.8rem;
		padding-top: 0.15rem;
		font-family: var(--font-text);
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--muted);
		text-align: end;
	}
	.summary {
		display: block;
		min-width: 0;
		padding: 0.15rem 0;
		border: none;
		background: none;
		box-shadow: none;
		text-align: start;
	}
	.summary:hover:not(:disabled) {
		background: none;
	}
	.preview {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-family: var(--font-text);
		white-space: pre-line;
	}
	.preview.empty,
	.editing {
		color: var(--muted);
		font-style: italic;
	}
	.move {
		display: flex;
	}
	.move button {
		font-size: 1.05rem;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		padding-inline-start: 2.55rem;
	}
	.note {
		margin: 0;
		padding-inline-start: 2.55rem;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.note.warn {
		color: var(--danger);
	}
	textarea {
		width: 100%;
		min-height: 8rem;
		field-sizing: content;
		font-family: var(--font-text);
		font-size: 1.05rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-inline-start: -0.55rem;
	}
	.actions :global(.remove) {
		margin-inline-start: auto;
		color: var(--danger);
	}
	.removed {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		background: none;
		box-shadow: none;
		border-style: dashed;
		color: var(--muted);
	}
	.removed p {
		margin: 0;
	}
	@media (max-width: 40rem) {
		.page {
			padding: 0.65rem 0.75rem;
		}
		.facts,
		.note,
		.chapter-start {
			padding-inline-start: 0;
		}
	}
</style>
