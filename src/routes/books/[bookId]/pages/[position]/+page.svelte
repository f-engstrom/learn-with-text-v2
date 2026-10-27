<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import { moveCursor } from '#lib/reading/cursor.ts';
	import { commandFor } from '#lib/reading/keys.ts';
	import { termKey } from '#lib/normalise.ts';
	import type { ReadingToken } from '#lib/server/domain/books.ts';
	import type { Highlight } from '#lib/server/domain/reading.ts';
	import type { Status } from '#lib/server/domain/terms.ts';
	import type { PageProps } from './$types';
	import Dictionaries from './Dictionaries.svelte';
	import TermForm from '#lib/components/TermForm.svelte';
	import WiktionaryPanel from './WiktionaryPanel.svelte';

	/** A Word, or a matched Multi-word Term, on the Page. */
	type Word = ReadingToken & { key: string; index: number; sentence: number };
	/** What the Term form and the Status keys act on: one Word, or a phrase you selected. */
	type Selection = Pick<Word, 'key' | 'text' | 'sentence'>;

	let { data, form }: PageProps = $props();

	let words = $derived(
		data.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t): t is Word => t.key !== undefined)))
	);
	let sentences = $derived(data.paragraphs.flatMap((p) => p.sentences));
	/** The Word the keyboard is on, by index; the Term form shows the selection while `open`. */
	let current = $state<number | undefined>();
	/** Where a phrase selection starts (Shift-click or Shift+arrow); it runs to `current`. */
	let anchor = $state<number | undefined>();
	let open = $state(false);
	let range = $derived(
		current === undefined ? undefined : ([Math.min(anchor ?? current, current), Math.max(anchor ?? current, current)] as const)
	);
	let selected: Selection | undefined = $derived.by(() => {
		if (!range) return undefined;
		const [first, last] = range;
		if (first === last) return words[first];
		const text = phraseText(first, last) ?? '';
		return { text, key: termKey(text, data.language), sentence: words[first].sentence };
	});
	let term = $derived(selected && data.terms[selected.key]);
	/** Statuses set by keyboard that the server hasn't confirmed yet, so the colour changes at once. */
	let pending = $state<Record<string, Status>>({});
	let error = $state<string | undefined>();
	let termForm = $state<ReturnType<typeof TermForm>>();
	/** The open Dictionary tab, kept while you move between Words. */
	let dictionary = $state<number | undefined>();
	let wordElements = $state<HTMLElement[]>([]);
	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');

	/** Zen mode: after a few idle seconds everything but the text fades, and the selection shows its Translations. */
	let zen = $state(false);
	let idle = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	const zenKey = 'reader.zen';
	let calm = $derived(zen && idle && !open);
	let gloss = $derived(zen && !open && term ? term.translations.map((t) => t.text).join('; ') : '');

	onMount(() => {
		try {
			zen = localStorage.getItem(zenKey) === 'on';
		} catch {}
		wake();
		return () => {
			clearTimeout(idleTimer);
			delete document.documentElement.dataset.calm;
		};
	});

	// The site header lives in the layout, so it fades by a flag on the page root.
	$effect(() => {
		if (calm) document.documentElement.dataset.calm = '';
		else delete document.documentElement.dataset.calm;
	});

	/** Brings everything back, and fades it again after three idle seconds while zen mode is on. */
	function wake() {
		idle = false;
		clearTimeout(idleTimer);
		if (zen) idleTimer = setTimeout(() => (idle = true), 3000);
	}

	function toggleZen() {
		zen = !zen;
		try {
			localStorage.setItem(zenKey, zen ? 'on' : 'off');
		} catch {}
		wake();
	}

	/** The Tutor's Highlight, kept current by polling while the Page is open. */
	let highlight = $state<Highlight | null>(null);
	$effect(() => {
		highlight = data.highlight;
	});
	let sentenceNumbers = $derived(new Map(sentences.map((s, i) => [s, i + 1])));
	let highlightHere = $derived(highlight?.page === data.position ? highlight : undefined);
	const highlighted = (sentence: (typeof sentences)[number]) => {
		const n = sentenceNumbers.get(sentence) ?? 0;
		return highlightHere !== undefined && n >= highlightHere.first && n <= highlightHere.last;
	};
	let highlightElement = $state<HTMLElement>();

	onMount(() => {
		const poll = setInterval(async () => {
			if (document.hidden) return;
			const latest: Highlight | null = await fetch(`/books/${data.book.id}/highlight`)
				.then((r) => (r.ok ? r.json() : highlight))
				.catch(() => highlight);
			if (latest?.at === highlight?.at) return;
			highlight = latest;
			// A new Highlight on this Page comes into view; the cursor and Bookmark stay put.
			if (latest?.page === data.position) {
				await tick();
				highlightElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}, 2000);
		return () => clearInterval(poll);
	});

	function showHighlight() {
		highlightElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	const statusOf = (key: string) => pending[key] ?? data.terms[key]?.status ?? 'unknown';
	const inPhrase = (index: number) => range !== undefined && range[0] < range[1] && index >= range[0] && index <= range[1];

	/**
	 * The text from Word `first` to Word `last`, if they are in one Sentence with only whitespace
	 * between them, as a Multi-word Term needs.
	 */
	function phraseText(first: number, last: number): string | undefined {
		if (words[first].sentence !== words[last].sentence) return undefined;
		const tokens = sentences[words[first].sentence].tokens;
		const between = tokens.slice(
			tokens.findIndex((t) => t.index === first),
			tokens.findIndex((t) => t.index === last) + 1
		);
		if (between.some((t) => t.key === undefined && t.text.trim() !== '')) return undefined;
		return between.map((t) => t.text).join('');
	}

	/** Grows or shrinks the phrase selection to end at Word `to`. */
	function extendTo(to: number) {
		const from = anchor ?? current;
		if (from === undefined) return goTo(to);
		if (phraseText(Math.min(from, to), Math.max(from, to)) === undefined) {
			error = 'A Multi-word Term stays inside one Sentence, with no punctuation between its Words.';
			return;
		}
		error = undefined;
		anchor = from;
		goTo(to);
	}

	// Saving or deleting a Multi-word Term regroups the Words, so the selection collapses to its start.
	let wordCount = $derived(words.length);
	$effect(() => {
		wordCount;
		untrack(() => {
			if (anchor !== undefined && current !== undefined) current = Math.min(anchor, current);
			anchor = undefined;
			if (current !== undefined && current >= words.length) current = words.length - 1;
		});
	});

	let pageKey = $derived(`${data.book.id}/${data.position}`);
	/** The Sentence and Word the Bookmark was last saved at from this screen, as "sentence|word". */
	let bookmarked = '';

	// Opening a Page moves the Bookmark here; on the bookmarked Page the cursor resumes at its Sentence and Word.
	$effect(() => {
		pageKey;
		untrack(enterPage);
	});

	// Moving the cursor into another Sentence moves the Bookmark with it.
	$effect(() => {
		if (selected) saveBookmark(selected.sentence + 1, selected.text);
	});

	function enterPage() {
		open = false;
		error = undefined;
		anchor = undefined;
		const { bookmark } = data.book;
		const here = bookmark.page === data.position;
		const sentence = here ? bookmark.sentence : 1;
		const inSentence = words.filter((w) => w.sentence === sentence - 1);
		// Back on the Bookmark's Word if it has one, else at the start of a later Sentence.
		const word = here ? bookmark.word?.toLocaleLowerCase() : undefined;
		const first = (word && inSentence.find((w) => w.text.toLocaleLowerCase() === word)) || (sentence > 1 ? inSentence[0] : undefined);
		current = first?.index;
		// Saved even when unchanged, so this Book becomes "where you are" for the Tutor.
		bookmarked = '';
		saveBookmark(sentence, first?.text);
		if (first) tick().then(() => wordElements[first.index]?.scrollIntoView({ block: 'center' }));
	}

	/** Moves the Bookmark to a Sentence on this Page and the Word or phrase selected in it. */
	function saveBookmark(sentence: number, word?: string) {
		const key = `${sentence}|${word ?? ''}`;
		if (key === bookmarked) return;
		bookmarked = key;
		const body = new FormData();
		body.set('sentence', String(sentence));
		if (word) body.set('word', word);
		fetch('?/bookmark', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
	}

	async function goTo(index: number | undefined, { collapse = false } = {}) {
		if (collapse) anchor = undefined;
		current = index;
		await tick();
		if (index !== undefined) wordElements[index]?.focus();
	}

	async function setStatus(word: Selection, status: Status) {
		pending[word.key] = status;
		const body = new FormData();
		body.set('languageId', String(data.language.id));
		body.set('text', word.text);
		body.set('status', status);
		const response = await fetch('?/setStatus', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await response.text());
		error = result.type === 'failure' ? String(result.data?.message) : undefined;
		await invalidateAll();
		delete pending[word.key];
	}

	/** Buttons and links handle Enter themselves. */
	function isControl(target: EventTarget | null) {
		return target instanceof HTMLElement && target.closest('button, a, summary') !== null;
	}

	function isTyping(target: EventTarget | null) {
		return (
			target instanceof HTMLElement &&
			(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
		);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.defaultPrevented) return;
		const command = commandFor(e, data.language.rightToLeft);
		// Reading on with the keyboard keeps zen mode calm; anything else brings the screen back.
		if (!command || !['move', 'sentence', 'extend', 'status'].includes(command.kind)) wake();
		// While typing in the Term form, only Escape (close) applies.
		if (!command || (isTyping(e.target) && command.kind !== 'close')) return;
		if (command.kind === 'open' && isControl(e.target)) return;
		e.preventDefault();
		switch (command.kind) {
			case 'move':
			case 'sentence':
				goTo(moveCursor(words, current, command), { collapse: true });
				break;
			case 'extend':
				if (current !== undefined) extendTo(Math.min(Math.max(current + command.by, 0), words.length - 1));
				break;
			case 'status':
				if (selected) setStatus(selected, command.status);
				break;
			case 'open':
				if (selected) open = true;
				break;
			case 'paste':
				if (selected) pasteTranslation();
				break;
			case 'zen':
				toggleZen();
				break;
			case 'close':
				open = false;
				goTo(current);
				break;
		}
	}

	async function pasteTranslation(copied?: string) {
		open = true;
		await tick();
		await (copied === undefined ? termForm?.pasteFromClipboard() : termForm?.pasteText(copied));
	}

	// ⌘V / Ctrl+V on the Page (not in a field) pastes as a Translation; unlike P it needs no permission.
	function onpaste(e: ClipboardEvent) {
		if (!selected || isTyping(e.target)) return;
		e.preventDefault();
		pasteTranslation(e.clipboardData?.getData('text/plain') ?? '');
	}

	function choose(word: Word, shift: boolean) {
		if (shift && current !== undefined) extendTo(word.index);
		else goTo(word.index, { collapse: true });
		open = true;
	}
</script>

<svelte:window {onkeydown} {onpaste} onmousemove={wake} onpointerdown={wake} />

<svelte:head>
	<title>{data.book.title} · Reader</title>
</svelte:head>

{#snippet keys()}
	<dl class="keys">
		<dt><kbd>←</kbd> <kbd>→</kbd></dt>
		<dd>Previous or next Word</dd>
		<dt><kbd>↑</kbd> <kbd>↓</kbd></dt>
		<dd>Previous or next Sentence</dd>
		<dt><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd></dt>
		<dd>Select a phrase (or Shift-click)</dd>
		<dt><kbd>1</kbd>–<kbd>4</kbd></dt>
		<dd>Learning 1–4</dd>
		<dt><kbd>K</kbd> <kbd>I</kbd></dt>
		<dd>Known, Ignored</dd>
		<dt><kbd>Enter</kbd></dt>
		<dd>Open the Term form</dd>
		<dt><kbd>P</kbd> <kbd>⌘V</kbd></dt>
		<dd>Paste as Translation</dd>
		<dt><kbd>Esc</kbd></dt>
		<dd>Close</dd>
		<dt><kbd>Z</kbd></dt>
		<dd>Zen mode</dd>
	</dl>
{/snippet}

{#snippet pages()}
	<nav class="pages" aria-label="Pages">
		{#if data.position > 1}
			<a class="button" href="/books/{data.book.id}/pages/{data.position - 1}">← Previous</a>
		{:else}
			<span></span>
		{/if}
		<span class="position">
			Page {data.position} of {data.book.pageCount}
			{#if data.read}<span class="tag read">Read</span>{/if}
		</span>
		{#if data.position < data.book.pageCount}
			<a class="button" href="/books/{data.book.id}/pages/{data.position + 1}">Next →</a>
		{:else}
			<span></span>
		{/if}
	</nav>
{/snippet}

<div class="chrome" class:calm>
	<header class="book">
		<h1 lang={data.language.code} {dir}>{data.book.title}</h1>
		<span class="tag">{data.language.name}</span>
		<button type="button" class="zen-toggle" aria-pressed={zen} onclick={toggleZen} title="Zen mode (Z)">Zen</button>
	</header>
	{@render pages()}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</div>

<div class="reader" class:calm>
	<article class="page" class:calm lang={data.language.code} {dir}>
		{#each data.paragraphs as paragraph, p (p)}
			<p>
				{#each paragraph.sentences as sentence, s (s)}
					{@const isHighlighted = highlighted(sentence)}
					{#if isHighlighted && sentenceNumbers.get(sentence) === highlightHere?.first}<span
							class="highlight-start"
							bind:this={highlightElement}
						></span>{/if}<span class="sentence" class:highlighted={isHighlighted}>
						{#each sentence.tokens as token, t (t)}
							{#if token.key !== undefined && token.index !== undefined}{@const word = token as Word}<span
									role="button"
									tabindex={word.index === (current ?? 0) ? 0 : -1}
									class="word {statusOf(word.key)}"
									class:current={current === word.index}
									class:phrase={inPhrase(word.index)}
									class:multi={(word.words ?? 1) > 1}
									bind:this={wordElements[word.index]}
									onmousedown={(e) => e.shiftKey && e.preventDefault()}
									onclick={(e) => choose(word, e.shiftKey)}
									onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose(word, false))}
									>{word.text}{#if gloss && range?.[0] === word.index}<span class="gloss" aria-hidden="true">{gloss}</span>{/if}</span
								>{:else}{token.text}{/if}
						{/each}
					</span>
				{/each}
			</p>
		{/each}
	</article>

	<aside class="side">
		{#if highlight}
			<div class="highlight-note card" role="status">
				<p class="from">From the Tutor</p>
				{#if highlight.note}<p class="note-text">{highlight.note}</p>{/if}
				{#if highlightHere}
					<button type="button" onclick={showHighlight}
						>{highlight.first === highlight.last ? `Sentence ${highlight.first}` : `Sentences ${highlight.first}–${highlight.last}`}</button
					>
				{:else}
					<a class="button" href="/books/{data.book.id}/pages/{highlight.page}">On Page {highlight.page} →</a>
				{/if}
			</div>
		{/if}
		{#if open && selected}
			<div class="term-panel card">
				<button type="button" class="close" aria-label="Close the Term form" onclick={() => (open = false)}>✕</button>
				{#key `${selected.key}:${JSON.stringify(term)}`}
					<TermForm bind:this={termForm} language={data.language} text={selected.text} {term} error={form?.message} />
				{/key}
				<WiktionaryPanel
					language={data.language}
					termKey={selected.key}
					text={selected.text}
					translations={term?.translations.map((t) => t.text) ?? []}
					onadd={(definition) => termForm?.addTranslation(definition, 'wiktionary')}
				/>
				<Dictionaries dictionaries={data.dictionaries} term={selected.key} bind:chosen={dictionary} />
			</div>
		{:else}
			<div class="help card">
				<p>Click a Word, or press <kbd>→</kbd> to start.</p>
				<details open>
					<summary>Keys</summary>
					{@render keys()}
				</details>
				<p class="legend">
					<span class="swatch unknown"></span> Unknown
					<span class="swatch learning1"></span> 1
					<span class="swatch learning2"></span> 2
					<span class="swatch learning3"></span> 3
					<span class="swatch learning4"></span> 4
					<span class="swatch known"></span> Known
				</p>
			</div>
		{/if}
	</aside>
</div>

<footer class="end chrome" class:calm>
	<form method="POST" action="?/markRead" class="mark-read" use:enhance>
		<button class="primary">Mark as read</button>
		<button name="restKnown" value="true">Mark as read, rest Known</button>
	</form>
	{@render pages()}
</footer>

<style>
	.book {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 1rem;
		margin-bottom: 1rem;
	}
	.book h1 {
		margin: 0;
	}
	.pages {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		max-width: 44rem;
	}
	.pages > :first-child {
		justify-self: start;
	}
	.pages > :last-child {
		justify-self: end;
	}
	.position {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted);
		font-size: 0.95rem;
		font-variant-numeric: tabular-nums;
	}
	.tag.read {
		background: color-mix(in srgb, var(--ok) 18%, transparent);
		color: var(--ok);
	}
	.reader {
		display: grid;
		grid-template-columns: minmax(0, 44rem) minmax(20rem, 1fr);
		gap: 3rem;
		align-items: start;
		margin-top: 1.5rem;
	}
	.page {
		font-family: var(--font-text);
		font-size: 1.3rem;
		line-height: 1.95;
	}
	.page p {
		margin: 0 0 1.1em;
	}
	/* Inline spans, not buttons: a button would let a line break before the punctuation after it. */
	.word {
		padding: 0.05em 0.08em;
		border-radius: 0.25em;
		cursor: pointer;
	}
	.word:focus {
		outline: none;
	}
	.word.current {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.word.phrase {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
	}
	/* A Multi-word Term reads as one unit. */
	.word.multi {
		text-decoration: underline dotted var(--muted);
		text-underline-offset: 0.25em;
	}
	.unknown {
		--status: var(--status-unknown);
	}
	.learning1 {
		--status: var(--status-learning1);
	}
	.learning2 {
		--status: var(--status-learning2);
	}
	.learning3 {
		--status: var(--status-learning3);
	}
	.learning4 {
		--status: var(--status-learning4);
	}
	.word,
	.swatch {
		background: var(--status, transparent);
		transition:
			background-color 0.6s,
			box-shadow 0.6s;
	}
	/* Zen mode, idle: Status colours soften to a faint underline. */
	.page.calm .word:not(.current) {
		background: transparent;
		box-shadow: inset 0 -0.12em var(--status, transparent);
	}
	.word {
		position: relative;
	}
	/* Zen mode: the selected Word's Translations, under it. */
	.gloss {
		position: absolute;
		top: calc(100% + 0.3rem);
		inset-inline-start: 0;
		z-index: 1;
		width: max-content;
		max-width: 18rem;
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
		font: 0.95rem/1.4 var(--font-ui);
		pointer-events: none;
	}
	.chrome,
	.side {
		transition: opacity 0.6s;
	}
	.chrome.calm,
	.reader.calm .side {
		opacity: 0;
		pointer-events: none;
	}
	:global(html[data-calm] header.site) {
		opacity: 0;
		pointer-events: none;
	}
	:global(header.site) {
		transition: opacity 0.6s;
	}
	.zen-toggle {
		margin-inline-start: auto;
		padding-block: 0.2rem;
		font-size: 0.85rem;
	}
	.zen-toggle[aria-pressed='true'] {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}
	.word.ignored {
		color: var(--status-ignored);
	}
	.side {
		position: sticky;
		top: 1rem;
		display: grid;
		gap: 1rem;
	}
	/* The Tutor's Highlight: a soft band over its Sentences. */
	.sentence.highlighted {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border-radius: 0.3em;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
		box-shadow: 0 0 0 0.12em color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.highlight-start {
		scroll-margin: 6rem;
	}
	.highlight-note {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
		border-inline-start: 4px solid var(--accent);
	}
	.highlight-note p {
		margin: 0;
	}
	.highlight-note .from {
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.note-text {
		font-size: 1.05rem;
	}
	.term-panel {
		position: relative;
		/* With a Dictionary open the panel is taller than the window, so it scrolls on its own. */
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		display: grid;
		gap: 1rem;
		box-sizing: border-box;
	}
	.close {
		position: absolute;
		top: 0.75rem;
		inset-inline-end: 0.75rem;
		padding: 0.2rem 0.5rem;
	}
	.help p {
		margin: 0 0 0.75rem;
	}
	.help summary {
		cursor: pointer;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}
	.keys {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 1rem;
		margin: 0 0 1rem;
		font-size: 0.9rem;
	}
	.keys dt {
		white-space: nowrap;
	}
	.keys dd {
		margin: 0;
		color: var(--muted);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.4rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.swatch {
		display: inline-block;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 0.2rem;
		margin-inline-start: 0.35rem;
	}
	.swatch.known {
		border: 1px solid var(--border);
	}
	.end {
		display: grid;
		gap: 1rem;
		max-width: 44rem;
		margin-top: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}
	.mark-read {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	@media (max-width: 60rem) {
		.reader {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}
		.side {
			position: static;
		}
		.help details:not([open]) + .legend,
		.help {
			font-size: 0.95rem;
		}
	}
</style>
