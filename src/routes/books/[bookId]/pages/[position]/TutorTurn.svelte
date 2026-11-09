<script lang="ts">
	import { tick } from 'svelte';
	import type { Answer, TutorQuestion } from '#lib/server/domain/from-tutor.ts';
	import type { Highlight } from '#lib/server/domain/reading.ts';
	import TutorQuestions from './TutorQuestions.svelte';

	interface Props {
		highlight: Highlight | null;
		question: TutorQuestion | null;
		/** The Highlight is on this Page, so the turn sits under it. */
		here: boolean;
		/** Put off with Later: shown as a pill. */
		folded: boolean;
		bookId: number;
		/** The Page's Language and direction, for its text in the turn. */
		lang: string;
		dir: 'rtl' | 'ltr';
		onanswer: (answer: Answer) => void;
		/** Escape: back to the text. */
		onleave: () => void;
		ondismiss: () => void;
		onfold: () => void;
		onunfold: () => void;
	}

	let { highlight, question, here, folded, bookId, lang, dir, onanswer, onleave, ondismiss, onfold, onunfold }: Props = $props();

	let questions = $state<TutorQuestions>();
	/** Waiting on your answer, rather than on the Tutor's. */
	let yourTurn = $derived(!!question && !question.answer);
	let yours = $derived(
		!question?.answer ? [] : 'ask' in question.answer ? [`You asked: ${question.answer.ask}`] : question.answer.answers
	);
	let waitingOn = $derived(
		!question
			? 'A note from the Tutor'
			: question.answer
				? 'Waiting for the Tutor'
				: question.questions.length === 1
					? 'A question from the Tutor'
					: `${question.questions.length} questions from the Tutor`
	);

	/** Puts the keyboard on the Tutor's question, opening the turn first if it was put off. */
	export async function focus() {
		if (folded) {
			onunfold();
			await tick();
		}
		questions?.focus();
	}

	async function later() {
		onfold();
		onleave();
	}
</script>

{#snippet context()}
	{#if highlight?.note}<p class="note-text">{highlight.note}</p>{/if}
	{#if question?.glosses}
		<ul class="glosses">
			{#each question.glosses as g (g.text)}
				<li><span {lang} {dir}>{g.text}</span> {g.gloss}</li>
			{/each}
		</ul>
	{/if}
	{#if highlight && !here}
		<a class="button" href="/books/{bookId}/pages/{highlight.page}">The Highlight is on Page {highlight.page} →</a>
	{/if}
{/snippet}

{#if folded}
	<button type="button" class="pill" onclick={focus}
		><span class="avatar" aria-hidden="true">T</span>{waitingOn} · <span class="open">Open</span>{#if yourTurn}<kbd class="t-hint">T</kbd>{/if}</button
	>
{:else}
	<section class="tutor-turn" class:here aria-label="From the Tutor" role="status">
		<header>
			<span class="avatar" aria-hidden="true">T</span>
			<span class="who">Tutor</span>
			{#if yourTurn}<kbd class="t-hint" title="Press T to answer">T</kbd>{/if}
			<span class="spacer"></span>
			<button type="button" class="quiet" title="Fold it away until you’re ready" onclick={later}>Later</button>
			<button type="button" class="quiet close" aria-label="Dismiss the Tutor" title="Dismiss until the Tutor asks again" onclick={ondismiss}
				>✕</button
			>
		</header>
		{#if question?.answer}
			<div class="sent">
				{#each yours as answer, i (i)}
					<p class="bubble">{answer}</p>
				{/each}
				<p class="waiting"><span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>Sent. The Tutor is reading; read on meanwhile.</p>
			</div>
		{:else if question}
			{#key question.askedAt}
				<TutorQuestions bind:this={questions} {question} {lang} {onanswer} {onleave}>
					{@render context()}
				</TutorQuestions>
			{/key}
		{:else}
			{@render context()}
		{/if}
	</section>
{/if}

<style>
	.tutor-turn {
		position: relative;
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		padding: 1rem 1.25rem 1.1rem;
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	/* Points up at the passage it is about. */
	.tutor-turn.here::before {
		content: '';
		position: absolute;
		top: -0.45rem;
		inset-inline-start: 2rem;
		width: 0.8rem;
		height: 0.8rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-inline-start: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: var(--surface);
		transform: rotate(45deg);
	}
	.tutor-turn p {
		margin: 0;
	}
	header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-self: stretch;
	}
	.avatar {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 700;
	}
	.who {
		font-weight: 600;
	}
	.spacer {
		flex: 1;
	}
	.quiet {
		padding: 0.2rem 0.55rem;
		border: none;
		background: none;
		box-shadow: none;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.note-text {
		font-size: 1.05rem;
	}
	.glosses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.glosses li {
		padding: 0.15rem 0.65rem;
		border-radius: 999px;
		background: var(--surface-2);
	}
	.glosses span {
		margin-inline-end: 0.3rem;
		color: var(--text);
		font-family: var(--font-text);
		font-size: 1rem;
	}
	.sent {
		display: grid;
		gap: 0.35rem;
		justify-self: stretch;
	}
	.bubble {
		justify-self: end;
		max-width: 85%;
		padding: 0.3rem 0.75rem;
		border-radius: 0.9rem 0.9rem 0.25rem 0.9rem;
		background: var(--accent-soft);
		white-space: pre-line;
	}
	.waiting {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem !important;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.dots {
		display: inline-flex;
		gap: 0.2rem;
	}
	.dots span {
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 1.2s infinite;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dots span {
			animation: none;
		}
	}
	.pill {
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.25rem 0.9rem 0.25rem 0.35rem;
		border-radius: 999px;
	}
	.pill .open {
		color: var(--accent);
	}
	/* T answers the Tutor; the hint goes once the keyboard is in the turn. */
	.t-hint {
		font-size: 0.7rem;
	}
	.tutor-turn:focus-within .t-hint {
		display: none;
	}
	@media (hover: none) and (pointer: coarse) {
		.t-hint {
			display: none;
		}
	}
</style>
