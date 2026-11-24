<!--
  A Tutor's question with a kind: words to put in order, gaps to fill, or words to match with meanings. What it
  shows is shuffled by its seed, the same each time; its answer is one line of text, from lib/question-kinds.ts,
  and empty until every part is done.
-->
<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { gapParts, gapsAnswer, matchAnswer, orderAnswer, shuffledIndexes } from '#lib/question-kinds.ts';
	import type { Question } from '#lib/server/domain/from-tutor.ts';
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';

	interface Props {
		question: Extract<Question, { kind: string }>;
		/** Fixes the shuffle: the same question shows the same way each time. */
		seed: string;
		/** The Page's Language, for its words. */
		lang: string;
		/** The answer for the Tutor; empty until every part is done. */
		value?: string;
	}

	let { question, seed, lang, value = $bindable('') }: Props = $props();
	// The card is keyed by when it was asked, so a question never changes under it.
	const q = untrack(() => question);
	const shuffle = (n: number) => shuffledIndexes(n, untrack(() => seed));

	// Order: the words as the bank shows them, and the ones placed on the line so far (by index into `words`).
	const bankOrder = q.kind === 'order' ? shuffle(q.words.length) : [];
	let placed = $state<number[]>([]);
	// Match: the right as shown; for each on the left, the one on the right it is paired with; the one being paired.
	const rightOrder = q.kind === 'match' ? shuffle(q.right.length) : [];
	let pairs = $state<(number | undefined)[]>(q.kind === 'match' ? q.left.map(() => undefined) : []);
	let chosen = $state<number | undefined>(q.kind === 'match' ? 0 : undefined);
	// Gaps: the text around them, what is in each, the bank as shown, and the gap a word from the bank goes to.
	const parts = q.kind === 'gaps' ? gapParts(q.text) : [];
	const bank = q.kind === 'gaps' && q.bank ? shuffle(q.bank.length).map((i) => q.bank![i]) : undefined;
	let fills = $state<string[]>(parts.slice(1).map(() => ''));
	let gap = $state(0);

	$effect(() => {
		if (q.kind === 'order') value = placed.length === q.words.length ? orderAnswer(placed.map((i) => q.words[i])) : '';
		else if (q.kind === 'match')
			value = pairs.every((p) => p !== undefined) ? matchAnswer(q.left, pairs.map((p) => q.right[p!])) : '';
		else value = fills.every((f) => f.trim()) ? gapsAnswer(q.text, fills) : '';
	});

	function pairWith(r: number) {
		if (chosen === undefined) return;
		const taken = pairs.indexOf(r);
		if (taken !== -1) pairs[taken] = undefined;
		pairs[chosen] = r;
		const open = pairs.findIndex((p) => p === undefined);
		chosen = open === -1 ? undefined : open;
	}

	function fromBank(word: string) {
		fills[gap] = word;
		const open = fills.findIndex((f) => !f);
		if (open !== -1) gap = open;
	}

	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const motion = (ms: number) => (reduced ? 0 : ms);
	const [send, receive] = crossfade({ duration: motion(220), easing: cubicOut });

	/** For an order question: a number places the word it is on, Backspace takes back the last. */
	function onkeydown(e: KeyboardEvent) {
		if (q.kind !== 'order' || e.ctrlKey || e.metaKey || e.altKey) return;
		const n = Number(e.key);
		if (n >= 1 && n <= bankOrder.length) {
			if (!placed.includes(bankOrder[n - 1])) placed.push(bankOrder[n - 1]);
		} else if (e.key === 'Backspace') placed.pop();
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
<div class="kind" {onkeydown} tabindex="-1" role="group">
	{#if q.kind === 'order'}
		<!-- A word glides between the line and its own slot in the bank, which stays where it was, so nothing else moves. -->
		<div class="line" {lang} role="group" aria-label="Your sentence">
			{#each placed as w, i (w)}
				<button
					type="button"
					class="tile"
					in:receive={{ key: w }}
					out:send={{ key: w }}
					animate:flip={{ duration: motion(180) }}
					onclick={() => placed.splice(i, 1)}>{q.words[w]}</button
				>
			{/each}
			{#if !placed.length}<span class="placeholder">Tap the words in order</span>{/if}
		</div>
		<div class="bank" {lang} role="group" aria-label="Words">
			{#each bankOrder as w, n (w)}
				<span class="slot">
					{#if !placed.includes(w)}
						<button type="button" class="tile" in:receive={{ key: w }} out:send={{ key: w }} onclick={() => placed.push(w)}
							><kbd class="hint">{n + 1}</kbd>{q.words[w]}</button
						>
					{/if}
					<span class="ghost" aria-hidden="true">{q.words[w]}</span>
				</span>
			{/each}
		</div>
		<p class="hint keys"><kbd>1</kbd>–<kbd>{q.words.length}</kbd> place · <kbd>⌫</kbd> take back the last</p>
	{:else if q.kind === 'match'}
		<div class="match">
			<div class="column" {lang}>
				{#each q.left as word, i (i)}
					<Button type="button" pressed={chosen === i} onclick={() => (chosen = i)}>
						{#if pairs[i] !== undefined}<span class="pair">{i + 1}</span>{/if}{word}
					</Button>
				{/each}
			</div>
			<div class="column">
				{#each rightOrder as r (r)}
					{@const by = pairs.indexOf(r)}
					<Button type="button" disabled={chosen === undefined && by === -1} onclick={() => pairWith(r)}>
						{#if by !== -1}<span class="pair">{by + 1}</span>{/if}{q.right[r]}
					</Button>
				{/each}
			</div>
		</div>
	{:else}
		<p class="gaps" {lang}>
			{#each parts as part, i (i)}{part}{#if i < fills.length}<input
						class:current={bank && gap === i}
						aria-label="Gap {i + 1}"
						size={Math.max(fills[i].length, 6)}
						bind:value={fills[i]}
						onfocus={() => (gap = i)}
						readonly={!!bank}
					/>{/if}{/each}
		</p>
		{#if bank}
			<div class="bank" {lang}>
				{#each bank as word (word)}
					<button type="button" class="tile" aria-pressed={fills.includes(word)} onclick={() => fromBank(word)}>{word}</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.kind {
		display: grid;
		gap: 0.75rem;
	}
	.kind:focus {
		outline: none;
	}
	/* Words of the Page's language are set like the text. */
	.line,
	.bank,
	.gaps,
	.column:first-child {
		font-family: var(--font-text);
		font-size: 1.05rem;
	}
	.line,
	.bank {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	/* The sentence being built: a ruled line the words sit on. */
	.line {
		min-height: 2.9rem;
		align-items: end;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--border);
	}
	.placeholder {
		color: var(--muted);
		font-family: var(--font-ui);
		font-size: 0.85rem;
	}
	.tile {
		font: inherit;
		padding: 0.3rem 0.65rem;
	}
	/* A word's place in the bank, sized by an invisible copy so the bank never reflows. */
	.slot {
		display: inline-grid;
	}
	.slot > * {
		grid-area: 1 / 1;
	}
	.ghost {
		padding: 0.3rem 0.65rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		color: transparent;
		user-select: none;
	}
	.slot:has(.tile) .ghost {
		border-color: transparent;
	}
	.tile[aria-pressed='true'] {
		opacity: 0.45;
	}
	/* A word's key sits on its corner, outside the flow, so the word keeps its size. */
	.tile {
		position: relative;
	}
	.tile kbd {
		position: absolute;
		top: -0.55rem;
		left: -0.45rem;
		font-family: var(--font-ui);
		font-size: 0.7rem;
	}
	.match {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.column {
		display: grid;
		gap: 0.4rem;
		align-content: start;
	}
	.column :global(button) {
		min-height: 2.75rem;
		text-align: start;
	}
	/* The same number on both sides of a pair. */
	.pair {
		display: inline-grid;
		place-items: center;
		width: 1.3rem;
		height: 1.3rem;
		margin-inline-end: 0.45rem;
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
		font-family: var(--font-ui);
		font-size: 0.75rem;
		font-weight: 600;
	}
	/* On a chosen (pressed) word the button is the accent, so the badge turns over. */
	.column :global([aria-pressed='true'] > .pair) {
		background: var(--on-accent);
		color: var(--accent);
	}
	.gaps {
		margin: 0;
		line-height: 2.2;
	}
	.gaps input {
		margin-inline: 0.2rem;
		padding: 0.1rem 0.4rem;
		font: inherit;
		text-align: center;
	}
	.gaps input.current {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-soft);
	}
	.keys {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}
	/* The keys show only while the keyboard is in use here (not after a click or a tap), and take no room
	   of their own, so showing them moves nothing. */
	.hint {
		visibility: hidden;
	}
	@media (hover: hover) {
		.kind:has(:focus-visible) .hint {
			visibility: visible;
		}
	}
	@media (max-width: 40rem) {
		.match {
			gap: 0.5rem;
		}
	}
</style>
