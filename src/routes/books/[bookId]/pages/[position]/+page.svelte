<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Count from '#lib/components/Count.svelte';
	import CloseButton from '#lib/components/CloseButton.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick, untrack } from 'svelte';
	import { ReadingScreen } from '#lib/reading/screen.svelte.ts';
	import type { Word } from '#lib/reading/selection.svelte.ts';
	import type { DaySoFar } from '#lib/server/domain/progress.ts';
	import type { PageProps } from './$types';
	import PracticePanel from './PracticePanel.svelte';
	import { TOP } from '#lib/reading/practice.svelte.ts';
	import Help from './Help.svelte';
	import PageText from './PageText.svelte';
	import TermPanel from './TermPanel.svelte';
	import TutorTurn from './TutorTurn.svelte';
	import Contents from './Contents.svelte';

	let { data, form }: PageProps = $props();

	/** The day so far, just after Mark as read: on the next Page, or here on the last one. */
	let daySoFar = $derived((form as { daySoFar?: DaySoFar } | null)?.daySoFar ?? data.daySoFar);
	let daySoFarDismissed = $state(false);
	$effect(() => {
		daySoFar;
		daySoFarDismissed = false;
	});
	let daySoFarParts = $derived.by(() => {
		if (!daySoFar) return [];
		const n = new Intl.NumberFormat();
		const count = (value: number, one: string, many: string) => `${n.format(value)} ${value === 1 ? one : many}`;
		return [
			`${count(daySoFar.wordsRead, 'Word', 'Words')} read`,
			daySoFar.newTerms > 0 && count(daySoFar.newTerms, 'new Term', 'new Terms'),
			daySoFar.nowKnown > 0 && `${n.format(daySoFar.nowKnown)} now Known`,
			daySoFar.reviews > 0 && count(daySoFar.reviews, 'Review', 'Reviews')
		].filter(Boolean);
	});
	function dismissDaySoFar() {
		daySoFarDismissed = true;
		// A reload shouldn't bring it back.
		if (page.url.searchParams.has('read')) {
			const url = new URL(page.url.href);
			url.searchParams.delete('read');
			replaceState(url, page.state);
		}
	}

	/** The Page's text, for reaching a Word's element. */
	let text = $state<PageText>();
	let termPanel = $state<TermPanel>();
	let tutorTurn = $state<TutorTurn>();
	let rail = $state<HTMLElement>();

	/** The reading screen's state and commands; this page is its markup. */
	const screen = new ReadingScreen(
		untrack(() => data),
		{
			view: {
				focusWord: (index) => text?.word(index)?.focus(),
				scrollToWord: (index, block) => text?.word(index)?.scrollIntoView({ block }),
				scrollToHighlight: () => text?.highlightStart()?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
				focusTutor: () => tutorTurn?.focus(),
				paste: async (copied) => {
					await (copied === undefined ? termPanel?.pasteFromClipboard() : termPanel?.pasteText(copied));
				},
				inDictionary: () => !!termPanel?.inDictionary(),
				reachDictionary: async () => {
					await termPanel?.reachDictionary();
				}
			},
			server: { reload: invalidateAll }
		}
	);
	$effect(() => {
		const latest = data;
		untrack(() => screen.sync(latest));
	});
	onMount(() => {
		const stop = screen.start();
		return () => {
			stop();
			delete document.documentElement.dataset.zen;
		};
	});

	const { selection, practice, zen: zenMode, fromTutor } = screen;
	let words = $derived(selection.words);
	let current = $derived(selection.cursor);
	let range = $derived(selection.range);
	let characters = $derived(selection.characters);
	let selected = $derived(selection.selected);
	let practising = $derived(practice.state);
	let zen = $derived(zenMode.on);
	let open = $derived(screen.open);
	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');

	// On a wide screen the column beside the text sticks only once the Page header has scrolled away; until then its
	// bottom, where Save sits, can be below the window. Opening the Term panel scrolls just enough to show it, keeping
	// the chosen Word on screen.
	$effect(() => {
		if (!open || !selected) return;
		untrack(() => tick().then(revealRail));
	});
	function revealRail() {
		if (!rail || getComputedStyle(rail).display === 'contents') return;
		const overflow = rail.getBoundingClientRect().bottom - innerHeight;
		const word = current === undefined ? undefined : text?.word(current)?.getBoundingClientRect();
		const by = Math.min(overflow, word ? word.top - 16 : overflow);
		// Not smooth: focusing the Word, which happens alongside, would cancel a smooth scroll.
		if (by > 0) window.scrollBy({ top: by });
	}

	// The site header lives in the layout, so zen hides it by a flag on the page root.
	$effect(() => {
		if (zen) document.documentElement.dataset.zen = '';
		else delete document.documentElement.dataset.zen;
	});

	/** In zen mode a tap outside the text dismisses the tooltip and shows the controls. */
	function onpointerdown(e: PointerEvent) {
		if (e.target instanceof Element && e.target.closest('.word, .zen-controls')) return;
		zenMode.tapOutside();
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
		const used = screen.key(e, {
			handled: e.defaultPrevented,
			inTutorCard: e.target instanceof HTMLElement && e.target.closest('.turn') !== null,
			typing: isTyping(e.target),
			onControl: isControl(e.target)
		});
		if (used) e.preventDefault();
	}

	// ⌘V / Ctrl+V on the Page (not in a field) pastes as a Translation; unlike P it needs no permission.
	function onpaste(e: ClipboardEvent) {
		if (!selected || isTyping(e.target)) return;
		e.preventDefault();
		screen.paste(e.clipboardData?.getData('text/plain') ?? '');
	}
</script>

<svelte:window {onkeydown} {onpaste} onmousemove={() => zenMode.wake()} {onpointerdown} />

<svelte:head>
	<title>{data.book.title} · Reader</title>
</svelte:head>

{#snippet turn()}
	<div class="turn" lang="en" dir="ltr">
		<TutorTurn
			bind:this={tutorTurn}
			highlight={fromTutor.highlight}
			question={fromTutor.question}
			here={screen.turnAt !== undefined}
			folded={fromTutor.folded}
			bookId={data.book.id}
			lang={data.language.code}
			{dir}
			onanswer={(answer) => screen.answerTutor(answer)}
			onleave={() => screen.leaveTutor()}
			ondismiss={() => fromTutor.dismiss()}
			onfold={() => fromTutor.fold()}
			onunfold={() => fromTutor.unfold()}
		/>
	</div>
{/snippet}

{#snippet pages(contents = false)}
	<nav class="pages" aria-label="Pages">
		{#if data.position > 1}
			<Button href="/books/{data.book.id}/pages/{data.position - 1}">← Previous</Button>
		{:else}
			<span></span>
		{/if}
		<span class="position">
			Page {data.position} of {data.book.pageCount}
			{#if data.read}<Tag tone="ok">Read</Tag>{/if}
			{#if contents}<Contents bookId={data.book.id} chapters={data.book.chapters} here={data.chapter} lang={data.language.code} {dir} />{/if}
		</span>
		{#if data.position < data.book.pageCount}
			<Button href="/books/{data.book.id}/pages/{data.position + 1}">Next →</Button>
		{:else}
			<span></span>
		{/if}
	</nav>
{/snippet}

<div class="chrome" class:zen>
	<header class="book">
		<h1 lang={data.language.code} {dir}>{data.book.title}</h1>
		<span class="about">
			<Tag>{data.language.name}</Tag>
			<Button href="/books/{data.book.id}/edit" variant="quiet" aria-label="Edit {data.book.title}">Edit</Button>
		</span>
		<span class="toggles">
			<Button type="button" onclick={() => screen.startPractice()} title="Practise the Due Words (R)"
				>Practice{#if screen.dueOnPage > 0}<Count value={screen.dueOnPage} />{/if}</Button
			>
			<Button type="button" pressed={screen.dueMarks.value} onclick={() => screen.dueMarks.toggle()} title="Due marks on the top {TOP} by priority (D)">Due</Button>
			<Button type="button" pressed={zen} onclick={() => zenMode.toggle()} title="Zen mode (Z)">Zen</Button>
		</span>
	</header>
	{@render pages(true)}
	{#if daySoFar && !daySoFarDismissed}
		<p class="day-so-far" role="status">
			<span><strong>Today</strong> · {daySoFarParts.join(' · ')}</span>
			<a href="/progress">Progress</a>
			<CloseButton label="Dismiss" onclick={dismissDaySoFar} inline />
		</p>
	{/if}
	{#if screen.error}
		<p class="error" role="alert">{screen.error}</p>
	{/if}
</div>

<div class="reader" class:zen class:sheet-open={open && !!selected && !practising}>
	<PageText
		bind:this={text}
		paragraphs={data.paragraphs}
		lang={data.language.code}
		{dir}
		{zen}
		practising={practising?.stage === 'run'}
		wordKeys={!practising}
		statusOf={screen.statusOf}
		overdueOf={screen.overdueOf}
		{current}
		inPhrase={(index) => selection.inPhrase(index)}
		onPage={screen.onPage}
		gloss={screen.gloss}
		glossAt={range?.[0]}
		turn={fromTutor.highlight || fromTutor.question ? turn : undefined}
		turnAt={screen.turnAt}
		onchoose={(word: Word, shift: boolean) => screen.choose(word.index, shift)}
	/>

	<!-- One sticky column beside the text; on a phone it dissolves below the Page. -->
	<div class="rail" bind:this={rail}>
		<aside class="side">
			{#if practising}
				<PracticePanel
					state={practising}
					subsets={practice.subsets}
					text={practice.word === undefined ? undefined : words[practice.word]?.text}
					term={practice.word === undefined ? undefined : data.terms[words[practice.word]?.key]}
					yourLanguages={data.yourLanguages}
					onpick={(subset) => practice.pick(subset)}
					onreveal={() => practice.reveal()}
					ongrade={(grade) => practice.grade(grade)}
					onstop={() => practice.stop()}
				/>
			{:else if open && selected}
				<TermPanel
					bind:this={termPanel}
					language={data.language}
					{selected}
					term={screen.term}
					band={screen.band}
					parts={characters && range ? { word: words[range[0]], characters, picked: selection.picked } : undefined}
					statusOf={screen.statusOf}
					dictionaries={data.dictionaries}
					wiktionaryPage={data.wiktionaryPage}
					azureReady={data.azureReady}
					yourLanguages={data.yourLanguages}
					dictionary={screen.dictionary.tab}
					onchoosedictionary={(tab) => screen.dictionary.choose(tab)}
					error={form?.message}
					onclose={() => (screen.open = false)}
					onwholeword={() => selection.wholeWord()}
					onpickcharacter={(i, shift) => selection.pickCharacter(i, shift)}
					onstatus={(status) => screen.setStatus(selected, status)}
					onreview={(termId, grade) => screen.review(termId, grade)}
				/>
			{:else}
				<Help />
			{/if}
		</aside>
	</div>

	<!-- In the grid, under the text: a long Term panel beside it grows the space below the buttons, not above them. -->
	<footer class="end chrome" class:zen>
		<form method="POST" action="?/markRead" class="mark-read" use:enhance>
			<Button variant="primary">Mark as read</Button>
			<Button name="restKnown" value="true">Mark as read, rest Known</Button>
		</form>
		{@render pages()}
	</footer>
</div>

{#if zen}
	<nav class="zen-controls" class:shown={!zenMode.idle} aria-label="Zen mode">
		{#if data.position > 1}
			<Button href="/books/{data.book.id}/pages/{data.position - 1}" aria-label="Previous Page">←</Button>
		{/if}
		<span class="position">Page {data.position} of {data.book.pageCount}</span>
		{#if data.position < data.book.pageCount}
			<Button href="/books/{data.book.id}/pages/{data.position + 1}" aria-label="Next Page">→</Button>
		{/if}
		<Button type="button" onclick={() => zenMode.toggle()}>Exit zen</Button>
	</nav>
{/if}

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
	.pages > :global(:first-child) {
		justify-self: start;
	}
	.pages > :global(:last-child) {
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
	/* The text, and beside it the Term panel or Practice; on a phone the panel comes below the text. */
	.reader {
		display: grid;
		grid-template-columns: minmax(0, 44rem) minmax(20rem, 1fr);
		/* The column beside the text spans the row under it too, so its extra height falls below the end's buttons. */
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'page rail'
			'end rail';
		gap: 1rem 3rem;
		align-items: start;
		margin-top: 1.5rem;
	}
	.rail {
		grid-area: rail;
		position: sticky;
		top: 1rem;
		/* One window's height; the Term panel scrolls within it. */
		max-height: calc(100vh - 2rem);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.side {
		grid-area: side;
		min-height: 0;
		overflow-y: auto;
	}
	/* Zen mode: nothing but the text, plain, centred and a little larger. */
	:global(html[data-zen] header.site),
	.chrome.zen,
	.end.zen,
	.reader.zen .rail {
		display: none;
	}
	.reader.zen {
		grid-template-columns: minmax(0, 38rem);
		grid-template-rows: auto;
		grid-template-areas: 'page';
		justify-content: center;
		margin-top: 3.5rem;
		padding-bottom: 6rem;
	}
	@media (max-width: 40rem) {
		.reader.zen {
			margin-top: 1.5rem;
		}
	}
	.zen-controls {
		position: fixed;
		bottom: 1.25rem;
		left: 50%;
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem 0.4rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		box-shadow: var(--shadow-lifted);
		backdrop-filter: blur(8px);
		opacity: 0;
		transform: translate(-50%, 0.5rem);
		pointer-events: none;
		transition:
			opacity 0.35s,
			transform 0.35s;
	}
	.zen-controls.shown {
		opacity: 1;
		transform: translate(-50%, 0);
		pointer-events: auto;
	}
	.zen-controls .position {
		color: var(--muted);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.zen-controls :global(.button),
	.zen-controls :global(button) {
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.about {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.toggles {
		display: flex;
		gap: 0.5rem;
		margin-inline-start: auto;
	}
	/* On a phone the title, its Language and Edit, and the toggles each take a row, from the start. */
	@media (max-width: 40rem) {
		.book {
			flex-direction: column;
			align-items: flex-start;
		}
		.toggles {
			margin-inline-start: 0;
		}
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	/* The Tutor's turn, in the text under its passage: back in the interface's own type. */
	.turn {
		margin: 0.4em 0 1.6rem;
		font-family: var(--font-ui);
		font-size: 1rem;
		line-height: 1.55;
		letter-spacing: normal;
	}
	.end {
		grid-area: end;
		align-self: start;
		display: grid;
		gap: 1rem;
		max-width: 44rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}
	.day-so-far {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 1rem;
		margin: 0.75rem 0 0;
		padding: 0.5rem 0.5rem 0.5rem 0.9rem;
		border: 1px solid var(--border);
		border-inline-start: 4px solid var(--ok);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--muted);
		font-size: 0.92rem;
	}
	.day-so-far strong {
		color: var(--text);
	}
	.day-so-far span {
		flex: 1;
	}
	.mark-read {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	@media (max-width: 60rem) {
		/* Room to scroll the last lines, and the chosen Word, clear of the sheet. */
		.reader.sheet-open {
			padding-bottom: 62vh;
		}
		.reader.sheet-open :global(.word) {
			scroll-margin: 5rem 0 64vh;
		}
		.reader {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'page' 'side' 'end';
			grid-template-rows: auto;
			gap: 1.5rem;
		}
		.rail {
			display: contents;
		}
		.side {
			min-height: 0;
			overflow: visible;
		}
	}
</style>
