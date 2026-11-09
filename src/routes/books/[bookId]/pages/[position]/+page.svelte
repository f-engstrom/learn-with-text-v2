<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick, untrack } from 'svelte';
	import { commandFor, routeKey, type Command } from '#lib/reading/keys.ts';
	import { PersistedFlag } from '#lib/reading/persisted-flag.svelte.ts';
	import { Zen } from '#lib/reading/zen.svelte.ts';
	import { termKey } from '#lib/normalise.ts';
	import { sendReview } from '#lib/reviews.ts';
	import { Selection, type Selected, type Word } from '#lib/reading/selection.svelte.ts';
	import type { Answer } from '#lib/server/domain/from-tutor.ts';
	import { FromTutor } from '#lib/reading/from-tutor.svelte.ts';
	import type { DaySoFar } from '#lib/server/domain/progress.ts';
	import type { Status } from '#lib/server/domain/terms.ts';
	import type { PageProps } from './$types';
	import Dictionaries from './Dictionaries.svelte';
	import TermForm from '#lib/components/TermForm.svelte';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import PracticeCard from './PracticeCard.svelte';
	import PracticePanel from './PracticePanel.svelte';
	import { Practice } from '#lib/reading/practice.svelte.ts';
	import { highlightOnPage } from '#lib/reading/highlight.ts';
	import { frequencyLabels, suggestedStatus, transferLabel } from '#lib/practice.ts';
	import { statusLabels } from '#lib/terms.ts';
	import WiktionaryPanel from './WiktionaryPanel.svelte';
	import AzurePanel from './AzurePanel.svelte';
	import TutorQuestions from './TutorQuestions.svelte';


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
				if (how === 'resume') wordElements[index]?.scrollIntoView({ block: 'center' });
				else wordElements[index]?.focus();
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
	let term = $derived(selected && data.terms[selected.key]);
	let band = $derived(selected && data.frequency[selected.key]);
	/** A Status the Tutor's assessment and Recall strength agree on, if it isn't yours. */
	let suggestion = $derived(term && suggestedStatus(term.status, term.tutorAssessment, term.practice));
	/** Statuses set by keyboard that the server hasn't confirmed yet, so the colour changes at once. */
	let pending = $state<Record<string, Status>>({});
	let error = $state<string | undefined>();
	let termForm = $state<ReturnType<typeof TermForm>>();
	/** The open Dictionary tab, kept while you move between Words. */
	let dictionary = $state<number | undefined>();
	let wordElements = $state<HTMLElement[]>([]);
	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');

	/** Due marks on the Words, on unless you turn them off (D). */
	const dueMarks = new PersistedFlag('reader.due', true);
	onMount(() => dueMarks.load());
	let showDue = $derived(dueMarks.value);
	const toggleDue = () => dueMarks.toggle();
	const overdueOf = (key: string) => (showDue ? (data.terms[key]?.practice?.overdue ?? 0) : 0);

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
				wordElements[index]?.scrollIntoView({ block: 'nearest' });
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

	/** Shifts the zen tooltip sideways so it stays on screen under a Word near either edge. */
	function keepInView(node: HTMLElement, _text: string) {
		// A margin, not a transform: a transformed box still widens the page from where it was laid out.
		const side = getComputedStyle(node).direction === 'rtl' ? 'marginRight' : 'marginLeft';
		const place = () => {
			node.style[side] = '';
			const box = node.getBoundingClientRect();
			const margin = 8;
			const width = document.documentElement.clientWidth;
			let shift = 0;
			if (box.right > width - margin) shift = width - margin - box.right;
			if (box.left + shift < margin) shift = margin - box.left;
			node.style[side] = `${side === 'marginRight' ? -shift : shift}px`;
		};
		place();
		return { update: place };
	}

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
			highlightElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
	let tutorQuestions = $state<TutorQuestions>();
	let sentenceIndex = $derived(new Map(sentences.map((s, i) => [s, i])));
	let highlightHere = $derived(highlight?.page === data.position ? highlight : undefined);
	/** Due Terms on this Page, each counted once. */
	let dueOnPage = $derived(showDue ? practice.dueCount : 0);

	/** Where the Highlight falls on this Page: its Sentences, or its passage's tokens. */
	let onPage = $derived(highlightOnPage(sentences, highlightHere, data.position));
	/** A whole Sentence underlined: when the Highlight has no passage. */
	const highlighted = (sentence: (typeof sentences)[number]) => !onPage?.tokens && !!onPage?.sentences.has(sentenceIndex.get(sentence)!);
	const inPassage = (sentence: (typeof sentences)[number], t: number) => !!onPage?.tokens?.has(`${sentenceIndex.get(sentence)}:${t}`);
	let highlightElement = $state<HTMLElement>();

	async function answerTutor(answer: Answer) {
		const refused = await fromTutor.answer(answer);
		if (refused) error = refused;
	}

	function dismissTutor() {
		fromTutor.dismiss();
	}

	function showHighlight() {
		highlightElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	const statusOf = (key: string) => pending[key] ?? data.terms[key]?.status ?? 'unknown';

	async function setStatus(word: Selected, status: Status) {
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
		const route = routeKey({
			handled: e.defaultPrevented,
			inTutorCard: e.target instanceof HTMLElement && e.target.closest('.highlight-note') !== null,
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
				tutorQuestions?.focus();
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
		await (copied === undefined ? termForm?.pasteFromClipboard() : termForm?.pasteText(copied));
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
		tick().then(() => wordElements[word.index]?.scrollIntoView({ block: 'nearest' }));
	}
</script>

<svelte:window {onkeydown} {onpaste} onmousemove={wake} {onpointerdown} />

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
		<dt>Characters</dt>
		<dd>In the Term form, pick part of a Chinese Word</dd>
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
		<dt><kbd>D</kbd></dt>
		<dd>Due marks on or off</dd>
		<dt><kbd>R</kbd></dt>
		<dd>Practise the Due Words</dd>
		<dt><kbd>T</kbd></dt>
		<dd>Answer the Tutor (<kbd>1</kbd>–<kbd>4</kbd> pick, <kbd>←</kbd> <kbd>→</kbd> questions, <kbd>Esc</kbd> back)</dd>
	</dl>
{/snippet}

{#snippet tutorContext()}
	{#if highlight}
		{#if highlight.note}<p class="note-text">{highlight.note}</p>{/if}
		{#if highlightHere && highlight.text}
			<button type="button" class="passage" lang={data.language.code} {dir} title="Show it in the text" onclick={showHighlight}
				>{highlight.text}</button
			>
		{:else if highlightHere}
			<button type="button" onclick={showHighlight}
				>{highlight.first === highlight.last ? `Sentence ${highlight.first}` : `Sentences ${highlight.first}–${highlight.last}`}</button
			>
		{:else}
			<a class="button" href="/books/{data.book.id}/pages/{highlight.page}">On Page {highlight.page} →</a>
		{/if}
	{/if}
	{#if question?.glosses}
		<ul class="glosses">
			{#each question.glosses as g (g.text)}
				<li><span lang={data.language.code} {dir}>{g.text}</span> {g.gloss}</li>
			{/each}
		</ul>
	{/if}
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

<div class="chrome" class:zen>
	<header class="book">
		<h1 lang={data.language.code} {dir}>{data.book.title}</h1>
		<span class="tag">{data.language.name}</span>
		<span class="toggles">
			<button type="button" onclick={startPractice} title="Practise the Due Words (R)"
				>Practice{#if dueOnPage > 0}<span class="count">{dueOnPage}</span>{/if}</button
			>
			<button type="button" aria-pressed={showDue} onclick={toggleDue} title="Due marks (D)">Due</button>
			<button type="button" aria-pressed={zen} onclick={toggleZen} title="Zen mode (Z)">Zen</button>
		</span>
	</header>
	{@render pages()}
	{#if daySoFar && !daySoFarDismissed}
		<p class="day-so-far" role="status">
			<span><strong>Today</strong> · {daySoFarParts.join(' · ')}</span>
			<a href="/progress">Progress</a>
			<button type="button" class="close" aria-label="Dismiss" onclick={dismissDaySoFar}>✕</button>
		</p>
	{/if}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</div>

<div class="reader" class:zen class:sheet-open={open && !!selected && !practising}>
	<article class="page" class:zen class:practising={practising?.stage === 'run'} lang={data.language.code} {dir}>
		{#each data.paragraphs as paragraph, p (p)}
			<p>
				{#each paragraph.sentences as sentence, s (s)}
					{@const isHighlighted = highlighted(sentence)}
					{#if sentenceIndex.get(sentence) === onPage?.first}<span
							class="highlight-start"
							bind:this={highlightElement}
						></span>{/if}<span class="sentence" class:highlighted={isHighlighted}>
						{#each sentence.tokens as token, t (t)}
							{#if token.key !== undefined && token.index !== undefined}{@const word = token as Word}<span
									role="button"
									tabindex={word.index === (current ?? 0) ? 0 : -1}
									class="word {statusOf(word.key)}"
									class:current={current === word.index}
									class:phrase={selection.inPhrase(word.index)}
									class:multi={(word.words ?? 1) > 1}
									class:in-passage={inPassage(sentence, t)}
									data-due={overdueOf(word.key) || undefined}
									bind:this={wordElements[word.index]}
									onmousedown={(e) => e.shiftKey && e.preventDefault()}
									onclick={(e) => choose(word, e.shiftKey)}
									onkeydown={(e) => !practising && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose(word, false))}
									>{word.text}{#if gloss && range?.[0] === word.index}<span class="gloss" aria-hidden="true" use:keepInView={gloss}>{gloss}</span>{/if}</span
								>{:else if inPassage(sentence, t)}<span class="in-passage">{token.text}</span>{:else}{token.text}{/if}
						{/each}
					</span>
				{/each}
			</p>
		{/each}
	</article>

	<!-- One sticky column beside the text; on a phone it dissolves so the note sits above the Page. -->
	<div class="rail">
		{#if highlight || question}
			<div class="highlight-note card" role="status">
				<p class="from">From the Tutor{#if question && !question.answer}<kbd class="t-hint" title="Press T to answer">T</kbd>{/if}</p>
				<button type="button" class="tutor-close" aria-label="Dismiss the Tutor" title="Dismiss until the Tutor asks again" onclick={dismissTutor}>✕</button>
				{#if question?.answer}
					<p class="sent">
						<span class="waiting">Sent, waiting for the Tutor…</span>
						<span class="yours">{'ask' in question.answer ? `You asked: ${question.answer.ask}` : question.answer.answers.join(' · ')}</span>
					</p>
				{:else if question}
					{#key question.askedAt}
						<TutorQuestions
							bind:this={tutorQuestions}
							{question}
							lang={data.language.code}
							onanswer={answerTutor}
							onleave={() => (current === undefined ? selection.moveTo(0) : selection.refocus())}
						>
							{@render tutorContext()}
						</TutorQuestions>
					{/key}
				{:else}
					{@render tutorContext()}
				{/if}
			</div>
		{/if}
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
				<div class="term-panel card">
					<button type="button" class="close" aria-label="Close the Term form" onclick={() => (open = false)}>✕</button>
					{#if characters && range}
						<div class="parts" role="group" aria-label="The whole Word or some of its characters">
							<button type="button" class="part {statusOf(words[range[0]].key)}" aria-pressed={!picked} onclick={() => selection.wholeWord()}
								>{words[range[0]].text}</button
							>
							{#each characters as character, i (i)}
								<button
									type="button"
									class="part {statusOf(termKey(character, data.language))}"
									aria-pressed={picked !== undefined && i >= picked[0] && i <= picked[1]}
									onmousedown={(e) => e.shiftKey && e.preventDefault()}
									onclick={(e) => selection.pickCharacter(i, e.shiftKey)}>{character}</button
								>
							{/each}
						</div>
					{/if}
					{#key `${selected.key}:${JSON.stringify(term)}`}
						<TermForm bind:this={termForm} language={data.language} text={selected.text} {term} error={form?.message} />
					{/key}
					{#if band || term?.transfer || term?.tutorAssessment}
						<dl class="facts">
							{#if band}<dt>Frequency</dt><dd>{frequencyLabels[band]}</dd>{/if}
							{#if term?.transfer}
								<dt>Transfer</dt>
								<dd>{transferLabel(term.transfer)}{#if term.transfer.reason}<small>{term.transfer.reason}</small>{/if}</dd>
							{/if}
							{#if term?.tutorAssessment}<dt>Tutor</dt><dd>{statusLabels[term.tutorAssessment]}</dd>{/if}
						</dl>
					{/if}
					{#if selected && term && suggestion}
						<p class="suggestion">
							{suggestion.from} to <strong>{statusLabels[suggestion.level]}</strong>; your Status is {statusLabels[term.status]}.
							<button type="button" onclick={() => setStatus(selected, suggestion.level)}>Set {statusLabels[suggestion.level]}</button>
						</p>
					{/if}
					{#if term?.practice}
						<PracticeCard {term} onreview={(grade) => review(term.id, grade)} />
					{/if}
					<WiktionaryPanel
						language={data.language}
						termKey={selected.key}
						text={selected.text}
						translations={term?.translations.map((t) => t.text) ?? []}
						onadd={(definition) => termForm?.addTranslation(definition, 'wiktionary')}
					/>
					<AzurePanel
						language={data.language}
						termKey={selected.key}
						text={selected.text}
						translations={term?.translations.map((t) => t.text) ?? []}
						onadd={(translation) => termForm?.addTranslation(translation, 'azure')}
					/>
					<Dictionaries dictionaries={data.dictionaries} term={selected.key} bind:chosen={dictionary} />
				</div>
			{:else}
				<div class="help card">
					<p class="start"><span class="pointer">Click a Word, or press <kbd>→</kbd> to start.</span><span class="touch">Tap a Word to open it.</span></p>
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
						<span class="due-dot"></span> Due
					</p>
				</div>
			{/if}
		</aside>
	</div>
</div>

{#if zen}
	<nav class="zen-controls" class:shown={!idle} aria-label="Zen mode">
		{#if data.position > 1}
			<a class="button" href="/books/{data.book.id}/pages/{data.position - 1}" aria-label="Previous Page">←</a>
		{/if}
		<span class="position">Page {data.position} of {data.book.pageCount}</span>
		{#if data.position < data.book.pageCount}
			<a class="button" href="/books/{data.book.id}/pages/{data.position + 1}" aria-label="Next Page">→</a>
		{/if}
		<button type="button" onclick={toggleZen}>Exit zen</button>
	</nav>
{/if}

<footer class="end chrome" class:zen>
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
	/* The Tutor's note sits above the side column beside the text, and above the text on a phone. */
	.reader {
		display: grid;
		grid-template-columns: minmax(0, 44rem) minmax(20rem, 1fr);
		grid-template-areas: 'page rail';
		gap: 1rem 3rem;
		align-items: start;
		margin-top: 1.5rem;
	}
	.page {
		grid-area: page;
	}
	.rail {
		grid-area: rail;
		position: sticky;
		top: 1rem;
		/* The note and the panel share one window's height; the Term panel scrolls within what is left. */
		max-height: calc(100vh - 2rem);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.highlight-note {
		grid-area: note;
		flex-shrink: 0;
	}
	.side {
		grid-area: side;
		min-height: 0;
		overflow-y: auto;
	}
	.page {
		font-family: var(--font-text);
		font-size: 1.32rem;
		line-height: 2;
		letter-spacing: 0.003em;
	}
	.page p {
		margin: 0 0 1.1em;
	}
	/* Inline spans, not buttons: a button would let a line break before the punctuation after it. */
	.word {
		padding: 0.02em 0.06em;
		border-radius: 0.2em;
		cursor: pointer;
	}
	.page:not(.zen) .word:hover {
		filter: brightness(0.96);
	}
	.word:focus {
		outline: none;
	}
	/* Above its neighbours, so a tooltip under it isn't covered by the next line's Words. */
	.word.current {
		z-index: 2;
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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
	.word {
		position: relative;
	}
	/* A Due Word: a dot over its end, amber when just Due, red when long overdue. */
	.word[data-due]::after {
		content: '';
		position: absolute;
		top: -0.12em;
		inset-inline-end: -0.12em;
		width: 0.36em;
		height: 0.36em;
		border-radius: 50%;
		background: var(--due-1);
		box-shadow: 0 0 0 1.5px var(--bg);
		pointer-events: none;
	}
	.word[data-due='2']::after {
		background: var(--due-2);
	}
	.word[data-due='3']::after {
		background: var(--due-3);
	}
	/* Zen mode: the tapped Word's Translations, under it. */
	.gloss {
		position: absolute;
		top: calc(100% + 0.3rem);
		inset-inline-start: 0;
		z-index: 1;
		width: max-content;
		max-width: min(18rem, calc(100vw - 1rem));
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
		font: 1rem/1.4 var(--font-ui);
		pointer-events: none;
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
	.page.zen {
		font-size: 1.45rem;
		line-height: 2.05;
	}
	@media (max-width: 40rem) {
		.reader.zen {
			margin-top: 1.5rem;
		}
		.page.zen {
			font-size: 1.28rem;
			line-height: 1.9;
		}
	}
	.page.zen .word {
		background: transparent;
		color: inherit;
	}
	.page.zen .word.multi,
	.page.zen .in-passage,
	.page.zen .sentence.highlighted {
		text-decoration: none;
	}
	.page.zen .word[data-due]::after {
		display: none;
	}
	/* The keyboard's place: a quiet tint rather than an outline. */
	.page.zen .word.current {
		outline: none;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
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
	.zen-controls .button,
	.zen-controls button {
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.toggles {
		display: flex;
		gap: 0.4rem;
		margin-inline-start: auto;
	}
	.toggles button {
		padding-block: 0.2rem;
		font-size: 0.85rem;
	}
	.toggles .count {
		margin-inline-start: 0.4rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--due-2);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 600;
	}
	.toggles button[aria-pressed='true'] {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}
	.word.ignored {
		color: var(--status-ignored);
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	/* The Tutor's Highlight, whole Sentences or a passage: a continuous accent underline, apart from the Status colours. */
	.sentence.highlighted,
	.in-passage,
	.word.multi.in-passage {
		text-decoration: underline var(--accent) 0.16em;
		text-underline-offset: 0.35em;
		text-decoration-skip-ink: none;
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
	.highlight-note {
		position: relative;
	}
	.tutor-close {
		position: absolute;
		top: 0.5rem;
		inset-inline-end: 0.5rem;
		padding: 0.15rem 0.45rem;
		border: none;
		background: none;
		box-shadow: none;
		color: var(--muted);
	}
	.passage {
		padding: 0.1rem 0 0.1rem 0.7rem;
		border: none;
		border-inline-start: 2px solid var(--border);
		border-radius: 0;
		background: none;
		box-shadow: none;
		color: var(--text);
		font-family: var(--font-text);
		font-size: 1.1rem;
		line-height: 1.5;
		text-align: start;
	}
	.passage:hover {
		border-inline-start-color: var(--accent);
	}
	.glosses {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.95rem;
	}
	.glosses span {
		margin-inline-end: 0.35rem;
		font-family: var(--font-text);
		font-size: 1.05rem;
		font-weight: 600;
	}
	.sent {
		display: grid;
		gap: 0.2rem;
	}
	.sent .waiting {
		color: var(--muted);
	}
	.sent .yours {
		color: var(--muted);
		font-size: 0.85rem;
		font-style: italic;
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
	/* T answers the Tutor; the hint goes once the keyboard is in the card. */
	.t-hint {
		margin-inline-start: 0.5rem;
		font-size: 0.7rem;
		text-transform: none;
	}
	.highlight-note:focus-within .t-hint {
		display: none;
	}
	@media (hover: none) and (pointer: coarse) {
		.t-hint {
			display: none;
		}
	}
	.term-panel {
		position: relative;
		/* With a Dictionary open the panel is taller than the window, so it scrolls on its own. */
		max-height: calc(100vh - 2rem);
		min-height: 0;
		overflow-y: auto;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		box-sizing: border-box;
	}
	/* Leaves room for the close button. */
	.parts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-inline-end: 2.5rem;
	}
	.part {
		background: var(--status, transparent);
		padding: 0.15rem 0.5rem;
		font-size: 1.15rem;
	}
	.part:first-child {
		margin-inline-end: 0.5rem;
	}
	.part[aria-pressed='true'] {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.75rem;
		margin: 0;
		font-size: 0.9rem;
	}
	.facts dt {
		color: var(--muted);
	}
	.facts dd {
		margin: 0;
	}
	.facts small {
		display: block;
		color: var(--muted);
	}
	.suggestion {
		margin: 0;
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius);
		background: var(--accent-soft);
		font-size: 0.9rem;
	}
	.suggestion button {
		margin-top: 0.4rem;
		padding-block: 0.2rem;
		font-size: 0.85rem;
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
	.due-dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		margin-inline-start: 0.35rem;
		border-radius: 50%;
		background: var(--due-2);
	}
	.start .touch {
		display: none;
	}
	/* A touch screen has no keys to list. */
	@media (hover: none) and (pointer: coarse) {
		.start .pointer,
		.help details {
			display: none;
		}
		.start .touch {
			display: inline;
		}
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
	.day-so-far .close {
		padding: 0.15rem 0.45rem;
		border: none;
		background: none;
		box-shadow: none;
		color: var(--muted);
	}
	.mark-read {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	@media (max-width: 60rem) {
		/* One column: the Term panel is a sheet over the bottom of the screen, not below the whole Page. */
		.term-panel {
			position: fixed;
			inset-inline: 0;
			bottom: 0;
			z-index: 3;
			max-height: 62vh;
			gap: 0.75rem;
			padding: 1rem;
			overflow-x: hidden;
			overscroll-behavior: contain;
			border-end-start-radius: 0;
			border-end-end-radius: 0;
			box-shadow: 0 -8px 30px rgb(0 0 0 / 0.18);
		}
		/* Room to scroll the last lines, and the chosen Word, clear of the sheet. */
		.reader.sheet-open {
			padding-bottom: 62vh;
		}
		.reader.sheet-open .word {
			scroll-margin: 5rem 0 64vh;
		}
		/* Keeps the practised Word above the practice panel docked at the bottom. */
		.page.practising .word {
			scroll-margin: 5rem 0 50vh;
		}
		.reader {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'note' 'page' 'side';
			grid-template-rows: auto;
			gap: 1.5rem;
		}
		.rail {
			display: contents;
		}
		.side {
			overflow: visible;
		}
		.help details:not([open]) + .legend,
		.help {
			font-size: 0.95rem;
		}
	}
</style>
