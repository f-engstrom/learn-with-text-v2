<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import CloseButton from '#lib/components/CloseButton.svelte';
	import Grades from '#lib/components/Grades.svelte';
	import { statusLabels } from '#lib/terms.ts';
	import { subsetLabels, type PracticeState, type Subset } from '#lib/reading/practice.svelte.ts';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import type { TermView } from '#lib/server/domain/terms.ts';

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
	<CloseButton label="Stop practising" onclick={onstop} />
	{#if state.stage === 'choose'}
		<h2>Practice</h2>
		{#if available.length === 0}
			<p class="muted">Nothing on this Page is Due.</p>
		{:else}
			<p class="muted">Which Due Words?</p>
			<ol class="subsets">
				{#each available as { subset, count }, i (subset)}
					<li>
						<Button type="button" key={`${i + 1}`} onclick={() => onpick(subset)}
							>{subsetLabels[subset]} <span class="count">{count}</span></Button
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
			<Button type="button" variant="primary" key="Space" onclick={onreveal}>Reveal</Button>
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
					<p class="muted">Recall: {statusLabels[term.practice.recall.level]}</p>
				{/if}
			{/if}
			<Grades {ongrade} keys />
		{/if}
	{:else}
		<h2>Practice done</h2>
		<p>{state.reviewed} {state.reviewed === 1 ? 'Review' : 'Reviews'} saved.</p>
		<Button type="button" key="Esc" onclick={onstop}>Back to reading</Button>
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
	.subsets {
		display: grid;
		gap: 0.4rem;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.subsets :global(button) {
		width: 100%;
		padding-block: 0.55rem;
	}
	.subsets .count {
		margin-inline-start: auto;
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
