<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { tick, untrack, type Snippet } from 'svelte';
	import { cardCommandFor } from '#lib/reading/keys.ts';
	import type { Answer, TutorQuestion } from '#lib/server/domain/from-tutor.ts';

	interface Props {
		question: TutorQuestion;
		/** The Page's Language, for typed answers. */
		lang: string;
		/** The context for every question: the Tutor's note, the passage and the Glosses. */
		children?: Snippet;
		onanswer: (answer: Answer) => void;
		/** Escape: back to the text. */
		onleave: () => void;
	}

	let { question, lang, children, onanswer, onleave }: Props = $props();

	// The page keys this component by `askedAt`, so a new question starts afresh.
	let drafts = $state<string[]>(untrack(() => question.questions.map(() => '')));
	let step = $state(0);
	let ownQuestion = $state('');
	let asking = $state(false);
	let stepElement = $state<HTMLElement>();

	const last = $derived(question.questions.length - 1);
	const current = $derived(question.questions[step]);
	const done = (i: number) => drafts[i]?.trim() !== '';
	const answered = $derived(drafts.every((_, i) => done(i)));

	/** Puts the keyboard on the current question: its text box, or the question itself for options. */
	export async function focus() {
		await tick();
		const box = stepElement?.querySelector('textarea');
		(box ?? stepElement)?.focus();
	}

	function goTo(i: number) {
		step = Math.min(Math.max(i, 0), last);
		focus();
	}

	/** Moves on from the current question once it has an answer; on the last one, sends (or goes to one still open). */
	function next() {
		if (!done(step)) return;
		if (step < last) return goTo(step + 1);
		if (answered) onanswer({ answers: drafts });
		else goTo(drafts.findIndex((_, i) => !done(i)));
	}

	let advancing: ReturnType<typeof setTimeout> | undefined;
	/** A picked option shows for a moment, then the next question comes. */
	function pick(option: string) {
		drafts[step] = option;
		clearTimeout(advancing);
		if (step === last) return;
		const from = step;
		advancing = setTimeout(() => step === from && goTo(from + 1), 300);
	}

	function onkeydown(e: KeyboardEvent) {
		if (asking) {
			if (e.key === 'Escape') {
				e.preventDefault();
				onleave();
			}
			return;
		}
		const typing = e.target instanceof HTMLTextAreaElement;
		const command = cardCommandFor(e, typing);
		if (!command) return;
		e.preventDefault();
		if (command.kind === 'leave') onleave();
		else if (command.kind === 'pick') {
			const option = current.options?.[command.option];
			if (option) pick(option);
		} else if (command.by === -1) goTo(step - 1);
		else if (done(step)) goTo(step + 1);
	}

	/** Enter moves a typed answer on (Shift+Enter starts a new line); Enter that ends IME composition (e.g. Cyrillic) doesn't. */
	function onEnter(e: KeyboardEvent, then: () => void) {
		if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
		e.preventDefault();
		then();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="tutor-questions" {onkeydown} role="group" aria-label="The Tutor's questions">
	{#if question.feedback}
		<p class="feedback">{question.feedback}</p>
	{/if}
	{@render children?.()}
		{#if asking}
			<form
				class="questions"
				onsubmit={(e) => {
					e.preventDefault();
					if (ownQuestion.trim()) onanswer({ ask: ownQuestion });
				}}
			>
				<label class="answer own"
					>Your question for the Tutor<!-- svelte-ignore a11y_autofocus --><textarea
						rows="3"
						autofocus
						bind:value={ownQuestion}
						onkeydown={(e) => onEnter(e, () => e.currentTarget.form?.requestSubmit())}
					></textarea></label
				>
				<div class="actions">
					<Button type="submit" variant="primary" disabled={!ownQuestion.trim()}>Ask</Button>
					<Button type="button" variant="link" onclick={() => ((asking = false), focus())}>Back to the question</Button>
				</div>
			</form>
		{:else}
			<form
				class="questions"
				onsubmit={(e) => {
					e.preventDefault();
					next();
				}}
			>
				{#if last > 0}
					<nav class="steps" aria-label="Questions">
						{#each question.questions as _, i (i)}
							<button
								type="button"
								class="dot"
								class:done={done(i)}
								aria-current={i === step ? 'step' : undefined}
								aria-label="Question {i + 1} of {last + 1}{done(i) ? ', answered' : ''}"
								onclick={() => goTo(i)}
							></button>
						{/each}
						<span class="count">Question {step + 1} of {last + 1}</span>
					</nav>
				{/if}
				<fieldset bind:this={stepElement} tabindex="-1">
					<legend>{current.prompt}</legend>
					{#if current.options}
						<div class="options">
							{#each current.options as option, o (option)}
								<Button type="button" pressed={drafts[step] === option} onclick={() => pick(option)}
									><kbd class="hint">{o + 1}</kbd>{option}</Button
								>
							{/each}
						</div>
					{:else}
						<label class="answer"
							>Your answer<textarea rows="2" {lang} bind:value={drafts[step]} onkeydown={(e) => onEnter(e, next)}></textarea></label
						>
					{/if}
				</fieldset>
				<div class="actions">
					{#if step === last}
						<Button type="submit" variant="primary" disabled={!answered}>{last > 0 ? 'Send answers' : 'Send answer'}</Button>
					{:else if !current.options}
						<Button type="submit" disabled={!done(step)}>Next</Button>
					{/if}
					<Button type="button" variant="link" onclick={() => (asking = true)}>Ask the Tutor instead</Button>
				</div>
				<p class="hint keys">
					{#if current.options}<kbd>1</kbd>–<kbd>{current.options.length}</kbd> pick ·{/if}
					{#if last > 0}<kbd>{current.options ? '←' : 'Alt ←'}</kbd> <kbd>{current.options ? '→' : 'Alt →'}</kbd> questions ·{/if}
					<kbd>Esc</kbd> back to the text
				</p>
			</form>
		{/if}
</div>

<style>
	.tutor-questions {
		display: grid;
		gap: 0.6rem;
		justify-items: start;
		justify-self: stretch;
	}
	/* Feedback first, the next questions under it: one turn, no Continue in between. */
	.feedback {
		margin: 0;
		white-space: pre-line;
	}
	.questions {
		display: grid;
		gap: 0.75rem;
		justify-self: stretch;
		padding-top: 0.6rem;
		border-top: 1px solid var(--border);
	}
	.steps {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	/* A bar per question, in a taller button so it is easy to hit. */
	.dot {
		--bar: var(--border);
		width: 1.75rem;
		height: 1rem;
		padding: 0;
		border: none;
		border-radius: 0;
		background: linear-gradient(var(--bar) 0 0) center / 100% 0.25rem no-repeat;
		box-shadow: none;
	}
	.dot:hover:not(:disabled) {
		--bar: color-mix(in srgb, var(--accent) 45%, var(--border));
		background: linear-gradient(var(--bar) 0 0) center / 100% 0.25rem no-repeat;
	}
	.dot.done {
		--bar: color-mix(in srgb, var(--accent) 50%, var(--border));
	}
	.dot[aria-current='step'] {
		--bar: var(--accent);
	}
	.count {
		margin-inline-start: 0.3rem;
		color: var(--muted);
		font-size: 0.8rem;
	}
	fieldset {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		border: none;
	}
	fieldset:focus {
		outline: none;
	}
	legend {
		padding: 0;
		margin-bottom: 0.4rem;
		font-family: var(--font-text);
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.4;
		white-space: pre-line;
	}
	textarea {
		width: 100%;
		font: inherit;
		resize: vertical;
	}
	.answer {
		display: grid;
		gap: 0.25rem;
		color: var(--muted);
		font-size: 0.85rem;
	}
	/* A typed answer is in the Page's language, so it is set like the text. */
	.answer textarea {
		color: var(--text);
		font-family: var(--font-text);
		font-size: 1rem;
		line-height: 1.5;
	}
	/* Your own question is to the Tutor, in your language: set like the screen around it. */
	.answer.own textarea {
		font-family: inherit;
	}
	.options {
		display: grid;
		gap: 0.5rem;
	}
	.options :global(button) {
		min-height: 2.75rem;
		text-align: start;
	}
	@media (max-width: 40rem) {
		.options :global(button) {
			min-height: 3rem;
		}
	}
	.options kbd {
		margin-inline-end: 0.4rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.keys {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}
	/* The keys show while the keyboard is in the card. */
	.hint {
		display: none;
	}
	.tutor-questions:focus-within .hint {
		display: revert;
	}
	@media (hover: none) and (pointer: coarse) {
		.tutor-questions:focus-within .hint {
			display: none;
		}
	}
</style>
