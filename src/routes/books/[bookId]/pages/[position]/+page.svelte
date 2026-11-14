<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Tag from '#lib/components/Tag.svelte';
	import Count from '#lib/components/Count.svelte';
	import CloseButton from '#lib/components/CloseButton.svelte';
	import { enhance } from '$app/forms';
	import { sendStatus } from '#lib/term-writes.ts';
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick, untrack } from 'svelte';
	import { commandFor, routeKey, type Command } from '#lib/reading/keys.ts';
	import { OpenDictionary, panelTabs } from '#lib/reading/open-dictionary.svelte.ts';
	import { PersistedFlag } from '#lib/reading/persisted-flag.svelte.ts';
	import { Zen } from '#lib/reading/zen.svelte.ts';
	import { sendReview } from '#lib/reviews.ts';
	import { Selection, type Selected, type Word } from '#lib/reading/selection.svelte.ts';
	import type { Answer } from '#lib/server/domain/from-tutor.ts';
	import { FromTutor } from '#lib/reading/from-tutor.svelte.ts';
	import type { DaySoFar } from '#lib/server/domain/progress.ts';
	import type { Status } from '#lib/server/domain/terms.ts';
	import type { PageProps } from './$types';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import PracticePanel from './PracticePanel.svelte';
	import { Practice, TOP } from '#lib/reading/practice.svelte.ts';
	import { highlightOnPage, turnPlace } from '#lib/reading/highlight.ts';
	import Help from './Help.svelte';
	import PageText from './PageText.svelte';
	import TermPanel from './TermPanel.svelte';
	import TutorTurn from './TutorTurn.svelte';


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

	/** The Selection; the Bookmark follows it. The Term form shows it while `open`. */
	const selection = new Selection(
		untrack(() => data),
		{
			onMoved: async (index, how) => {
				await tick();
				if (how === 'resume') text?.word(index)?.scrollIntoView({ block: 'center' });
				else text?.word(index)?.focus();
			}
		}
	);
	$effect(() => {
		const page = data;
		untrack(() => {
			if (selection.sync(page)) {
				open = false;
				error = undefined;
			}
		});
	});
	let words = $derived(selection.words);
	let sentences = $derived(selection.sentences);
	let current = $derived(selection.cursor);
	let range = $derived(selection.range);
	let characters = $derived(selection.characters);
	let picked = $derived(selection.picked);
	let selected = $derived(selection.selected);
	let open = $state(false);
	let rail = $state<HTMLElement>();
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
	let term = $derived(selected && data.terms[selected.key]);
	let band = $derived(selected && data.frequency[selected.key]);
	/** Statuses set by keyboard that the server hasn't confirmed yet, so the colour changes at once. */
	let pending = $state<Record<string, Status>>({});
	let error = $state<string | undefined>();
	let termPanel = $state<TermPanel>();
	/** The open Dictionary, kept while you move between Words and for each Language. */
	const dictionary = new OpenDictionary();
	$effect(() => dictionary.load(data.language.id));
	/** The Page's text, for reaching a Word's element. */
	let text = $state<PageText>();
	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');

	/** Due marks on the Words of the Top by priority Terms, on unless you turn them off (D). */
	const dueMarks = new PersistedFlag('reader.due', true);
	onMount(() => dueMarks.load());
	let showDue = $derived(dueMarks.value);
	const toggleDue = () => dueMarks.toggle();
	const overdueOf = (key: string): 0 | 1 | 2 | 3 => (showDue && practice.marked.has(key) ? (data.terms[key]?.practice?.overdue ?? 0) : 0);

	/** The 1-based paragraph each Sentence (by 0-based index) is in. */
	let paragraphOf = $derived(data.paragraphs.flatMap((p, i) => p.sentences.map(() => i + 1)));
	/** Practice on the Page: the cursor walks its queue. */
	const practice = new Practice(
		() => ({
			words,
			terms: data.terms,
			frequency: data.frequency,
			paragraphOf,
			// "This paragraph" is the cursor's, else the first.
			paragraph: current === undefined ? 1 : paragraphOf[words[current].sentence],
			highlight: highlightHere,
			rightToLeft: data.language.rightToLeft
		}),
		{
			onReviewed: () => {
				error = undefined;
				return invalidateAll();
			},
			onRefused: (message) => (error = message),
			// The cursor goes onto the practised Word, scrolled clear of the practice panel.
			onShow: async (index) => {
				selection.moveTo(index);
				await tick();
				text?.word(index)?.scrollIntoView({ block: 'nearest' });
			},
			onStop: () => selection.refocus()
		}
	);
	let practising = $derived(practice.state);
	let recalling = $derived(practice.recalling);

	function startPractice() {
		open = false;
		practice.start();
	}

	/** A Review from the Practice card in the Term panel. */
	async function review(termId: number, grade: Grade) {
		error = await sendReview(termId, grade, 'page');
		await invalidateAll();
	}

	/** Zen mode: only the text; toggling it closes the Term form. */
	const zenMode = new Zen({ onChange: () => (open = false) });
	let zen = $derived(zenMode.on);
	let idle = $derived(zenMode.idle);
	const toggleZen = () => zenMode.toggle();
	const wake = () => zenMode.wake();
	let gloss = $derived.by(() => {
		if (!zen || !zenMode.glossShown || recalling || !selected) return '';
		return term?.translations.map((t) => t.text).join('; ') || 'No Translation yet';
	});

	onMount(() => {
		zenMode.load();
		return () => {
			zenMode.destroy();
			delete document.documentElement.dataset.zen;
		};
	});

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

	/** From the Tutor: its Highlight and question, kept current while the Page is open. */
	const fromTutor = new FromTutor(untrack(() => tutorState()), {
		// The Tutor saved a Gloss or changed a Term: the Page's Statuses and Translations follow.
		onTermsChanged: () => invalidateAll(),
		// A new Highlight on this Page comes into view; the cursor and Bookmark stay put.
		onNewHighlight: async (h) => {
			if (h.page !== data.position) return;
			await tick();
			text?.highlightStart()?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	});
	function tutorState() {
		return { bookId: data.book.id, highlight: data.highlight, question: data.question, termsVersion: data.termsVersion };
	}
	$effect(() => {
		const latest = tutorState();
		untrack(() => fromTutor.sync(latest));
	});
	onMount(() => fromTutor.start());
	let highlight = $derived(fromTutor.highlight);
	/** TutorQuestions keeps what you write, per `askedAt`. */
	let question = $derived(fromTutor.question);
	let tutorTurn = $state<TutorTurn>();
	let highlightHere = $derived(highlight?.page === data.position ? highlight : undefined);
	/** Due Terms on this Page, each counted once. */
	let dueOnPage = $derived(showDue ? practice.dueCount : 0);

	/** Where the Highlight falls on this Page: its Sentences, or its passage's tokens. */
	let onPage = $derived(highlightOnPage(sentences, highlightHere, data.position));
	/** The Tutor's turn follows the Sentence its Highlight ends with; with no Highlight here it opens the Page. */
	let turnAt = $derived(turnPlace(data.paragraphs, onPage));

	async function answerTutor(answer: Answer) {
		const refused = await fromTutor.answer(answer);
		if (refused) error = refused;
	}

	function dismissTutor() {
		fromTutor.dismiss();
	}

	const statusOf = (key: string): Status | 'unknown' => pending[key] ?? data.terms[key]?.status ?? 'unknown';

	async function setStatus(word: Selected, status: Status) {
		pending[word.key] = status;
		error = await sendStatus(data.language.id, word.text, status);
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
		const route = routeKey({
			handled: e.defaultPrevented,
			inTutorCard: e.target instanceof HTMLElement && e.target.closest('.turn') !== null,
			typing: isTyping(e.target),
			onControl: isControl(e.target),
			zen,
			command: commandFor(e, data.language.rightToLeft),
			practice: () => practice.key(e)
		});
		if (route.to === 'none') return;
		e.preventDefault();
		if (route.to === 'zen') return route.key === 'enter' ? zenMode.enter() : zenMode.escape();
		if (route.to === 'reading') run(route.command);
	}

	/** Carries out a reading command. */
	function run(command: Command) {
		switch (command.kind) {
			case 'move':
			case 'sentence':
				selection.move(command);
				break;
			case 'extend':
				error = selection.move(command);
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
			case 'due':
				toggleDue();
				break;
			case 'practice':
				zenMode.leave();
				startPractice();
				break;
			case 'tutor':
				tutorTurn?.focus();
				break;
			case 'dictionary':
				if (open && selected) dictionary.step(panelTabs(data.dictionaries, data.azureReady), command.by);
				break;
			case 'close':
				open = false;
				selection.refocus();
				break;
		}
	}

	async function pasteTranslation(copied?: string) {
		open = true;
		await tick();
		await (copied === undefined ? termPanel?.pasteFromClipboard() : termPanel?.pasteText(copied));
	}

	// ⌘V / Ctrl+V on the Page (not in a field) pastes as a Translation; unlike P it needs no permission.
	function onpaste(e: ClipboardEvent) {
		if (!selected || isTyping(e.target)) return;
		e.preventDefault();
		pasteTranslation(e.clipboardData?.getData('text/plain') ?? '');
	}

	function choose(word: Word, shift: boolean) {
		const { again, error: refused } = selection.choose(word.index, shift);
		if (shift) error = refused;
		// In zen mode a tap shows the Word's Translations; tapping it again hides them.
		if (zen) {
			zenMode.tapWord(again);
			return;
		}
		open = true;
		// On a phone the Term panel is a sheet over the bottom of the screen; keep the Word above it.
		tick().then(() => text?.word(word.index)?.scrollIntoView({ block: 'nearest' }));
	}
</script>

<svelte:window {onkeydown} {onpaste} onmousemove={wake} {onpointerdown} />

<svelte:head>
	<title>{data.book.title} · Reader</title>
</svelte:head>

{#snippet turn()}
	<div class="turn" lang="en" dir="ltr">
		<TutorTurn
			bind:this={tutorTurn}
			{highlight}
			{question}
			here={turnAt !== undefined}
			folded={fromTutor.folded}
			bookId={data.book.id}
			lang={data.language.code}
			{dir}
			onanswer={answerTutor}
			onleave={() => (current === undefined ? selection.moveTo(0) : selection.refocus())}
			ondismiss={dismissTutor}
			onfold={() => fromTutor.fold()}
			onunfold={() => fromTutor.unfold()}
		/>
	</div>
{/snippet}

{#snippet pages()}
	<nav class="pages" aria-label="Pages">
		{#if data.position > 1}
			<Button href="/books/{data.book.id}/pages/{data.position - 1}">← Previous</Button>
		{:else}
			<span></span>
		{/if}
		<span class="position">
			Page {data.position} of {data.book.pageCount}
			{#if data.read}<Tag tone="ok">Read</Tag>{/if}
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
		<Tag>{data.language.name}</Tag>
		<span class="toggles">
			<Button type="button" onclick={startPractice} title="Practise the Due Words (R)"
				>Practice{#if dueOnPage > 0}<Count value={dueOnPage} />{/if}</Button
			>
			<Button type="button" pressed={showDue} onclick={toggleDue} title="Due marks on the top {TOP} by priority (D)">Due</Button>
			<Button type="button" pressed={zen} onclick={toggleZen} title="Zen mode (Z)">Zen</Button>
		</span>
	</header>
	{@render pages()}
	{#if daySoFar && !daySoFarDismissed}
		<p class="day-so-far" role="status">
			<span><strong>Today</strong> · {daySoFarParts.join(' · ')}</span>
			<a href="/progress">Progress</a>
			<CloseButton label="Dismiss" onclick={dismissDaySoFar} inline />
		</p>
	{/if}
	{#if error}
		<p class="error" role="alert">{error}</p>
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
		{statusOf}
		{overdueOf}
		{current}
		inPhrase={(index) => selection.inPhrase(index)}
		{onPage}
		{gloss}
		glossAt={range?.[0]}
		turn={highlight || question ? turn : undefined}
		{turnAt}
		onchoose={choose}
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
					{term}
					{band}
					parts={characters && range ? { word: words[range[0]], characters, picked } : undefined}
					{statusOf}
					dictionaries={data.dictionaries}
					wiktionaryPage={data.wiktionaryPage}
					azureReady={data.azureReady}
					dictionary={dictionary.tab}
					onchoosedictionary={(tab) => dictionary.choose(tab)}
					error={form?.message}
					onclose={() => (open = false)}
					onwholeword={() => selection.wholeWord()}
					onpickcharacter={(i, shift) => selection.pickCharacter(i, shift)}
					onstatus={(status) => setStatus(selected, status)}
					onreview={review}
				/>
			{:else}
				<Help />
			{/if}
		</aside>
	</div>
</div>

{#if zen}
	<nav class="zen-controls" class:shown={!idle} aria-label="Zen mode">
		{#if data.position > 1}
			<Button href="/books/{data.book.id}/pages/{data.position - 1}" aria-label="Previous Page">←</Button>
		{/if}
		<span class="position">Page {data.position} of {data.book.pageCount}</span>
		{#if data.position < data.book.pageCount}
			<Button href="/books/{data.book.id}/pages/{data.position + 1}" aria-label="Next Page">→</Button>
		{/if}
		<Button type="button" onclick={toggleZen}>Exit zen</Button>
	</nav>
{/if}

<footer class="end chrome" class:zen>
	<form method="POST" action="?/markRead" class="mark-read" use:enhance>
		<Button variant="primary">Mark as read</Button>
		<Button name="restKnown" value="true">Mark as read, rest Known</Button>
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
		grid-template-areas: 'page rail';
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
	.toggles {
		display: flex;
		gap: 0.5rem;
		margin-inline-start: auto;
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
		display: grid;
		gap: 1rem;
		max-width: 44rem;
		margin-top: 1rem;
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
			grid-template-areas: 'page' 'side';
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
