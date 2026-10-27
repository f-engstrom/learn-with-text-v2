<script lang="ts">
	import { levelLabels, subsetLabels, type Subset } from '#lib/practice.ts';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import type { TermView } from '#lib/server/domain/terms.ts';

	/** Practice on the Page: choosing a subset, then one Due Word at a time, then a summary. */
	export type PracticeState =
		| { stage: 'choose' }
		| { stage: 'run'; subset: Subset; queue: number[]; at: number; revealed: boolean; reviewed: number }
		| { stage: 'done'; reviewed: number };

	interface Props {
		state: PracticeState;
		/** Each subset with how many Due Words it holds, in key order. */
		subsets: { subset: Subset; count: number }[];
		/** The Word being practised, as written, and its Term. */
		text: string | undefined;
		term: TermView | undefined;
		onpick: (subset: Subset) => void;
		onreveal: () => void;
		ongrade: (grade: Grade) => void;
		onstop: () => void;
	}

	let { state, subsets, text, term, onpick, onreveal, ongrade, onstop }: Props = $props();
	let available = $derived(subsets.filter((s) => s.count > 0));
</script>

<div class="practice-panel card" aria-live="polite">
	<button type="button" class="close" aria-label="Stop practising" onclick={onstop}>✕</button>
	{#if state.stage === 'choose'}
		<h2>Practice</h2>
		{#if available.length === 0}
			<p class="muted">Nothing on this Page is Due.</p>
		{:else}
			<p class="muted">Which Due Words?</p>
			<ol class="subsets">
				{#each available as { subset, count }, i (subset)}
					<li>
						<button type="button" onclick={() => onpick(subset)}
							><kbd>{i + 1}</kbd> {subsetLabels[subset]} <span class="count">{count}</span></button
						>
					</li>
				{/each}
			</ol>
		{/if}
	{:else if state.stage === 'run'}
		<h2>Practice <span class="muted">{state.at + 1} of {state.queue.length}</span></h2>
		<p class="word">{text}</p>
		{#if !state.revealed}
			<p class="muted">Recall it in its Sentence, then reveal.</p>
			<button type="button" class="primary" onclick={onreveal}><kbd>Space</kbd> Reveal</button>
		{:else}
			{#if term}
				<ul class="meaning">
					{#each term.translations as translation (translation.id)}<li>{translation.text}</li>{/each}
				</ul>
				{#if term.parent || term.pronunciation}
					<p class="muted">
						{#if term.pronunciation}{term.pronunciation}{/if}
						{#if term.parent}from {term.parent.text}{/if}
					</p>
				{/if}
				{#if term.practice?.recall}
					<p class="muted">Recall: {levelLabels[term.practice.recall.level]}</p>
				{/if}
			{/if}
			<div class="grades" role="group" aria-label="How did it go?">
				<button type="button" onclick={() => ongrade('missed')}><kbd>1</kbd> Missed</button>
				<button type="button" onclick={() => ongrade('hard')}><kbd>2</kbd> Hard</button>
				<button type="button" onclick={() => ongrade('got')}><kbd>3</kbd> Got it</button>
			</div>
		{/if}
	{:else}
		<h2>Practice done</h2>
		<p>{state.reviewed} {state.reviewed === 1 ? 'Review' : 'Reviews'} saved.</p>
		<button type="button" onclick={onstop}><kbd>Esc</kbd> Back to reading</button>
	{/if}
</div>

<style>
	.practice-panel {
		position: relative;
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		border-inline-start: 4px solid var(--due-2);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	p {
		margin: 0;
	}
	.close {
		position: absolute;
		top: 0.75rem;
		inset-inline-end: 0.75rem;
		padding: 0.2rem 0.5rem;
	}
	.subsets {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.count {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.word {
		font-family: var(--font-text);
		font-size: 1.5rem;
	}
	.meaning {
		margin: 0;
		padding-inline-start: 1.2rem;
		font-size: 1.05rem;
	}
	.grades {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	/* One column: the side column sits below the text, so the panel docks to the bottom of the window. */
	@media (max-width: 60rem) {
		.practice-panel {
			position: fixed;
			inset-inline: var(--gutter);
			bottom: var(--gutter);
			z-index: 2;
			max-height: 45vh;
			overflow-y: auto;
			box-shadow: 0 8px 30px rgb(0 0 0 / 0.18);
		}
	}
</style>
