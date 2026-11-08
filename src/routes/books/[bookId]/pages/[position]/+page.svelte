<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick, untrack } from 'svelte';
	import { moveCursor } from '#lib/reading/cursor.ts';
	import { commandFor } from '#lib/reading/keys.ts';
	import { characterParts, termKey } from '#lib/normalise.ts';
	import type { ReadingToken } from '#lib/server/domain/books.ts';
	import type { Highlight } from '#lib/server/domain/reading.ts';
	import type { Answer, TutorQuestion } from '#lib/server/domain/from-tutor.ts';
	import type { DaySoFar } from '#lib/server/domain/progress.ts';
	import type { Status } from '#lib/server/domain/terms.ts';
	import type { PageProps } from './$types';
	import Dictionaries from './Dictionaries.svelte';
	import TermForm from '#lib/components/TermForm.svelte';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import PracticeCard from './PracticeCard.svelte';
	import PracticePanel, { type PracticeState } from './PracticePanel.svelte';
	import { passageParts } from '#lib/reading/passage.ts';
	import { frequencyLabels, levelLabels, practiceQueue, suggestedStatus, transferLabel, type DueWord, type Subset } from '#lib/practice.ts';
	import WiktionaryPanel from './WiktionaryPanel.svelte';
	import AzurePanel from './AzurePanel.svelte';
	import TutorQuestions from './TutorQuestions.svelte';

	/** A Word, or a matched Multi-word Term, on the Page. */
	type Word = ReadingToken & { key: string; index: number; sentence: number };
	/** What the Term form and the Status keys act on: one Word, or a phrase you selected. */
	type Selection = Pick<Word, 'key' | 'text' | 'sentence'>;

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
	/** The characters of the one selected Word, if it is written in characters you can pick from. */
	let characters = $derived(range && range[0] === range[1] ? characterParts(words[range[0]].text) : undefined);
	/** Characters you picked within Word `word` in the Term panel, from `anchor` to `focus`. */
	let part = $state<{ word: number; anchor: number; focus: number }>();
	let picked = $derived.by(() => {
		if (!characters || !part || part.word !== range?.[0]) return undefined;
		return [Math.min(part.anchor, part.focus), Math.max(part.anchor, part.focus)] as const;
	});
	let selected: Selection | undefined = $derived.by(() => {
		if (!range) return undefined;
		const [first, last] = range;
		if (first === last && characters && picked) {
			const text = characters.slice(picked[0], picked[1] + 1).join('');
			return { text, key: termKey(text, data.language), sentence: words[first].sentence };
		}
		if (first === last) return words[first];
		const text = phraseText(first, last) ?? '';
		return { text, key: termKey(text, data.language), sentence: words[first].sentence };
	});
	let term = $derived(selected && data.terms[selected.key]);
	let band = $derived(selected && data.frequency[selected.key]);
	/** A Status the Tutor's assessment and Recall strength agree on, if it isn't yours. */
	let suggestion = $derived(term && suggestedStatus(term.status, term.tutor, term.practice));
	/** Statuses set by keyboard that the server hasn't confirmed yet, so the colour changes at once. */
	let pending = $state<Record<string, Status>>({});
	let error = $state<string | undefined>();
	let termForm = $state<ReturnType<typeof TermForm>>();
	/** The open Dictionary tab, kept while you move between Words. */
	let dictionary = $state<number | undefined>();
	let wordElements = $state<HTMLElement[]>([]);
	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');

	/** Due marks on the Words, on unless you turn them off (D). */
	let showDue = $state(true);
	const dueKey = 'reader.due';
	onMount(() => {
		try {
			showDue = localStorage.getItem(dueKey) !== 'off';
		} catch {}
	});
	function toggleDue() {
		showDue = !showDue;
		try {
			localStorage.setItem(dueKey, showDue ? 'on' : 'off');
		} catch {}
	}
	const overdueOf = (key: string) => (showDue ? (data.terms[key]?.practice?.overdue ?? 0) : 0);

	/** The 1-based paragraph each Sentence (by 0-based index) is in. */
	let paragraphOf = $derived(data.paragraphs.flatMap((p, i) => p.sentences.map(() => i + 1)));
	let dueWords: DueWord[] = $derived(
		words.flatMap((w) => {
			const practice = data.terms[w.key]?.practice;
			return practice
				? [
						{
							index: w.index,
							key: w.key,
							sentence: w.sentence + 1,
							paragraph: paragraphOf[w.sentence],
							practice,
							frequency: data.frequency[w.key],
							transfer: data.terms[w.key]?.transfer
						}
					]
				: [];
		})
	);
	function startPractice() {
		open = false;
		practising = { stage: 'choose' };
	}

	function pickSubset(subset: Subset) {
		const queue = practiceQueue(dueWords, subset, practiceContext);
		if (queue.length === 0) return;
		practising = { stage: 'run', subset, queue, at: 0, revealed: false, reviewed: 0 };
		showPractised(queue[0]);
	}

	/** Puts the cursor on a practised Word and scrolls it clear of the practice panel. */
	async function showPractised(index: number) {
		await goTo(index, { collapse: true });
		wordElements[index]?.scrollIntoView({ block: 'nearest' });
	}

	/** While a practice Review is saving, so a quick second key can't grade the same Word twice. */
	let grading = false;

	async function gradePractice(grade: Grade) {
		if (practising?.stage !== 'run' || grading) return;
		const run = practising;
		const word = words[run.queue[run.at]];
		const reviewed = data.terms[word.key];
		grading = true;
		try {
			if (reviewed) await review(reviewed.id, grade);
		} finally {
			grading = false;
		}
		if (error) return;
		const at = run.at + 1;
		if (at >= run.queue.length) {
			practising = { stage: 'done', reviewed: run.reviewed + 1 };
			return;
		}
		practising = { ...run, at, revealed: false, reviewed: run.reviewed + 1 };
		showPractised(run.queue[at]);
	}

	function stopPractice() {
		practising = undefined;
		goTo(current);
	}

	/** Practice keys: digits pick a subset or grade, Space reveals, Esc stops. Returns whether it handled the key. */
	function practiceKey(e: KeyboardEvent): boolean {
		if (!practising || e.ctrlKey || e.metaKey || e.altKey) return false;
		if (e.key === 'Escape') {
			stopPractice();
			return true;
		}
		const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
		if (practising.stage === 'choose' && digit) {
			const choice = subsets.filter((s) => s.count > 0)[Number(digit) - 1];
			if (choice) pickSubset(choice.subset);
			return true;
		}
		if (practising.stage === 'run') {
			if (e.code === 'Space' || e.code === 'Enter') {
				practising.revealed = true;
				return true;
			}
			if (digit && Number(digit) <= 3) {
				gradePractice((['missed', 'hard', 'got'] as const)[Number(digit) - 1]);
				return true;
			}
			// Reading keys stay off while practising, so a Status key can't be pressed by mistake.
			return commandFor(e, data.language.rightToLeft) !== undefined;
		}
		return false;
	}

	async function review(termId: number, grade: Grade) {
		const body = new FormData();
		body.set('termId', String(termId));
		body.set('grade', grade);
		body.set('source', 'page');
		const response = await fetch('?/review', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await response.text());
		error = result.type === 'failure' ? String(result.data?.message) : undefined;
		await invalidateAll();
	}

	/**
	 * Zen mode: only the text, plain and centred. Tapping a Word shows its Translations; the Page arrows
	 * and Exit appear while you move the mouse or tap outside the text.
	 */
	let zen = $state(false);
	let idle = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	const zenKey = 'reader.zen';
	/** Whether the selected Word's Translation tooltip is showing, in zen mode. */
	let glossShown = $state(false);
	/** Practice on the Page, while it's open. */
	let practising = $state<PracticeState | undefined>();
	/** While a practised Word's meaning is still hidden. */
	let recalling = $derived(practising?.stage === 'run' && !practising.revealed);
	let gloss = $derived.by(() => {
		if (!zen || !glossShown || recalling || !selected) return '';
		return term?.translations.map((t) => t.text).join('; ') || 'No Translation yet';
	});

	onMount(() => {
		try {
			zen = localStorage.getItem(zenKey) === 'on';
		} catch {}
		wake();
		return () => {
			clearTimeout(idleTimer);
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

	/** Shows zen mode's controls, and hides them again after a couple of idle seconds. */
	function wake() {
		idle = false;
		clearTimeout(idleTimer);
		if (zen) idleTimer = setTimeout(() => (idle = true), 2500);
	}

	function toggleZen() {
		zen = !zen;
		open = false;
		glossShown = false;
		try {
			localStorage.setItem(zenKey, zen ? 'on' : 'off');
		} catch {}
		wake();
	}

	/** In zen mode a tap outside the text dismisses the tooltip and shows the controls. */
	function onpointerdown(e: PointerEvent) {
		if (!zen) return;
		if (e.target instanceof Element && e.target.closest('.word, .zen-controls')) return;
		glossShown = false;
		wake();
	}

	/** The Tutor's Highlight, kept current by polling while the Page is open. */
	let highlight = $state<Highlight | null>(null);
	$effect(() => {
		highlight = data.highlight;
	});
	let sentenceNumbers = $derived(new Map(sentences.map((s, i) => [s, i + 1])));
	let highlightHere = $derived(highlight?.page === data.position ? highlight : undefined);
	/** Where "This paragraph" is: the cursor's paragraph, else the first. */
	let practiceContext = $derived({
		paragraph: current === undefined ? 1 : paragraphOf[words[current].sentence],
		highlight: highlightHere
	});
	const subsetOrder: Subset[] = ['priority', 'paragraph', 'highlight', 'overdue'];
	/** Due Terms on this Page, each counted once. */
	let dueOnPage = $derived(showDue ? practiceQueue(dueWords, 'overdue').length : 0);
	let subsets = $derived(
		subsetOrder
			.filter((s) => s !== 'highlight' || highlightHere)
			.map((subset) => ({ subset, count: practiceQueue(dueWords, subset, practiceContext).length }))
	);

	/** Whether a Sentence is in the Highlight's run of Sentences. */
	const inHighlight = (sentence: (typeof sentences)[number]) => {
		const n = sentenceNumbers.get(sentence) ?? 0;
		return highlightHere !== undefined && n >= highlightHere.first && n <= highlightHere.last;
	};
	/** A whole Sentence underlined: when the Highlight has no passage. */
	const highlighted = (sentence: (typeof sentences)[number]) => inHighlight(sentence) && !highlightHere?.text;
	/** With a passage, the tokens it covers, as "sentence:token" (1-based Sentence on the Page). */
	let passage = $derived.by(() => {
		const text = highlightHere?.text;
		if (!text) return new Set<string>();
		const keys: string[] = [];
		const parts: string[] = [];
		for (const sentence of sentences.filter(inHighlight)) {
			const n = sentenceNumbers.get(sentence)!;
			sentence.tokens.forEach((token, t) => {
				keys.push(`${n}:${t}`);
				parts.push(token.text);
			});
			// Sentences may not end in a space; keep their last and first Words apart.
			keys.push('');
			parts.push(' ');
		}
		return new Set((passageParts(parts, text) ?? []).map((i) => keys[i]).filter(Boolean));
	});
	const inPassage = (sentence: (typeof sentences)[number], t: number) => passage.has(`${sentenceNumbers.get(sentence)}:${t}`);
	let highlightElement = $state<HTMLElement>();

	/** The Tutor's question, kept current by the same polling; TutorQuestions keeps what you write, per `askedAt`. */
	let question = $state<TutorQuestion | null>(null);
	let tutorQuestions = $state<TutorQuestions>();
	$effect(() => {
		const latest = data.question;
		untrack(() => showQuestion(latest));
	});
	function showQuestion(latest: TutorQuestion | null) {
		question = latest;
	}

	async function answerTutor(answer: Answer) {
		if (!question) return;
		const body = new FormData();
		body.set('askedAt', question.askedAt);
		body.set('answer', JSON.stringify(answer));
		const response = await fetch('?/answer', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await response.text());
		if (result.type === 'failure') error = String(result.data?.message ?? 'Could not send your answer.');
		else question = { ...question, answer };
	}

	/** Puts the Tutor aside: its question and Highlight leave the screen until it asks again. */
	function dismissTutor() {
		highlight = null;
		question = null;
		fetch('?/dismissTutor', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
	}

	let refreshingTerms = false;
	onMount(() => {
		const poll = setInterval(async () => {
			if (document.hidden) return;
			const latest: { highlight: Highlight | null; question: TutorQuestion | null; termsVersion: number } = await fetch(
				`/books/${data.book.id}/tutor`
			)
				.then((r) => (r.ok ? r.json() : { highlight, question, termsVersion: data.termsVersion }))
				.catch(() => ({ highlight, question, termsVersion: data.termsVersion }));
			showQuestion(latest.question);
			// The Tutor saved a Gloss or changed a Term: the Page's Statuses and Translations follow.
			if (latest.termsVersion !== data.termsVersion && !refreshingTerms) {
				refreshingTerms = true;
				invalidateAll().finally(() => (refreshingTerms = false));
			}
			if (latest.highlight?.at === highlight?.at) return;
			highlight = latest.highlight;
			// A new Highlight on this Page comes into view; the cursor and Bookmark stay put.
			if (latest.highlight?.page === data.position) {
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
			part = undefined;
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
		// The Tutor's card has its own keys.
		if (e.target instanceof HTMLElement && e.target.closest('.highlight-note')) return;
		if (!isTyping(e.target) && practiceKey(e)) {
			e.preventDefault();
			return;
		}
		const command = commandFor(e, data.language.rightToLeft);
		// In zen mode Enter shows or hides the Translation tooltip, and Escape leaves.
		if (zen && command?.kind === 'open') {
			e.preventDefault();
			glossShown = !glossShown;
			return;
		}
		if (zen && command?.kind === 'close') {
			e.preventDefault();
			if (glossShown) glossShown = false;
			else toggleZen();
			return;
		}
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
			case 'due':
				toggleDue();
				break;
			case 'practice':
				if (zen) toggleZen();
				startPractice();
				break;
			case 'tutor':
				tutorQuestions?.focus();
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

	/** Picks a character of the selected Word for the Term form; Shift-click picks a run of them. */
	function pickCharacter(index: number, shift: boolean) {
		if (!range) return;
		part = { word: range[0], anchor: shift && part?.word === range[0] ? part.anchor : index, focus: index };
	}

	function choose(word: Word, shift: boolean) {
		const again = current === word.index && !shift;
		if (shift && current !== undefined) extendTo(word.index);
		else goTo(word.index, { collapse: true });
		// In zen mode a tap shows the Word's Translations; tapping it again hides them.
		if (zen) {
			glossShown = !(again && glossShown);
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
					{#if inHighlight(sentence) && sentenceNumbers.get(sentence) === highlightHere?.first}<span
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
							onleave={() => goTo(current ?? 0)}
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
					{subsets}
					text={practising.stage === 'run' ? words[practising.queue[practising.at]]?.text : undefined}
					term={practising.stage === 'run' ? data.terms[words[practising.queue[practising.at]]?.key] : undefined}
					onpick={pickSubset}
					onreveal={() => practising?.stage === 'run' && (practising.revealed = true)}
					ongrade={gradePractice}
					onstop={stopPractice}
				/>
			{:else if open && selected}
				<div class="term-panel card">
					<button type="button" class="close" aria-label="Close the Term form" onclick={() => (open = false)}>✕</button>
					{#if characters && range}
						<div class="parts" role="group" aria-label="The whole Word or some of its characters">
							<button type="button" class="part {statusOf(words[range[0]].key)}" aria-pressed={!picked} onclick={() => (part = undefined)}
								>{words[range[0]].text}</button
							>
							{#each characters as character, i (i)}
								<button
									type="button"
									class="part {statusOf(termKey(character, data.language))}"
									aria-pressed={picked !== undefined && i >= picked[0] && i <= picked[1]}
									onmousedown={(e) => e.shiftKey && e.preventDefault()}
									onclick={(e) => pickCharacter(i, e.shiftKey)}>{character}</button
								>
							{/each}
						</div>
					{/if}
					{#key `${selected.key}:${JSON.stringify(term)}`}
						<TermForm bind:this={termForm} language={data.language} text={selected.text} {term} error={form?.message} />
					{/key}
					{#if band || term?.transfer || term?.tutor}
						<dl class="facts">
							{#if band}<dt>Frequency</dt><dd>{frequencyLabels[band]}</dd>{/if}
							{#if term?.transfer}
								<dt>Transfer</dt>
								<dd>{transferLabel(term.transfer)}{#if term.transfer.reason}<small>{term.transfer.reason}</small>{/if}</dd>
							{/if}
							{#if term?.tutor}<dt>Tutor</dt><dd>{levelLabels[term.tutor]}</dd>{/if}
						</dl>
					{/if}
					{#if selected && term && suggestion}
						<p class="suggestion">
							{suggestion.from} to <strong>{levelLabels[suggestion.level]}</strong>; your Status is {levelLabels[term.status]}.
							<button type="button" onclick={() => setStatus(selected, suggestion.level)}>Set {levelLabels[suggestion.level]}</button>
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
