<script lang="ts">
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
	/** Feedback on the last answer comes on its own, before the new round's passage and questions. */
	let reviewing = $state(untrack(() => !!question.feedback));
	let stepElement = $state<HTMLElement>();
	let continueButton = $state<HTMLButtonElement>();

	const last = $derived(question.questions.length - 1);
	const current = $derived(question.questions[step]);
	const done = (i: number) => drafts[i]?.trim() !== '';
	const answered = $derived(drafts.every((_, i) => done(i)));

	/** Puts the keyboard on the current question: its text box, or the question itself for options; on the feedback, its Continue. */
	export async function focus() {
		await tick();
		if (reviewing) return continueButton?.focus();
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

	function startRound() {
		reviewing = false;
		focus();
	}

	function onkeydown(e: KeyboardEvent) {
		if (asking || reviewing) {
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
	{#if reviewing}
		<section class="feedback" aria-label="Your last answer">
			<p class="label">Your last answer</p>
			<p>{question.feedback}</p>
		</section>
		<div class="actions">
			<button type="button" class="primary" bind:this={continueButton} onclick={startRound}>Continue</button>
		</div>
		<p class="hint keys"><kbd>Enter</kbd> continue · <kbd>Esc</kbd> back to the text</p>
	{:else}
		{@render children?.()}
		{#if asking}
			<form
				class="questions"
				onsubmit={(e) => {
					e.preventDefault();
					if (ownQuestion.trim()) onanswer({ ask: ownQuestion });
				}}
			>
				<fieldset>
					<legend>Your question for the Tutor</legend>
					<!-- svelte-ignore a11y_autofocus -->
					<textarea rows="2" autofocus bind:value={ownQuestion} onkeydown={(e) => onEnter(e, () => e.currentTarget.form?.requestSubmit())}
					></textarea>
				</fieldset>
				<div class="actions">
					<button type="submit" class="primary" disabled={!ownQuestion.trim()}>Ask</button>
					<button type="button" class="link" onclick={() => ((asking = false), focus())}>Back to the question</button>
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
						<span class="count">{step + 1} of {last + 1}</span>
					</nav>
				{/if}
				<fieldset bind:this={stepElement} tabindex="-1">
					<legend>{current.prompt}</legend>
					{#if current.options}
						<div class="options">
							{#each current.options as option, o (option)}
								<button type="button" aria-pressed={drafts[step] === option} onclick={() => pick(option)}
									><kbd class="hint">{o + 1}</kbd>{option}</button
								>
							{/each}
						</div>
					{:else}
						<textarea rows="2" {lang} bind:value={drafts[step]} onkeydown={(e) => onEnter(e, next)}></textarea>
					{/if}
				</fieldset>
				<div class="actions">
					{#if step === last}
						<button type="submit" class="primary" disabled={!answered}>Send</button>
					{:else if !current.options}
						<button type="submit" disabled={!done(step)}>Next</button>
					{/if}
					<button type="button" class="link" onclick={() => (asking = true)}>Ask the Tutor something first</button>
				</div>
				<p class="hint keys">
					{#if current.options}<kbd>1</kbd>–<kbd>{current.options.length}</kbd> pick ·{/if}
					{#if last > 0}<kbd>{current.options ? '←' : 'Alt ←'}</kbd> <kbd>{current.options ? '→' : 'Alt →'}</kbd> questions ·{/if}
					<kbd>Esc</kbd> back to the text
				</p>
			</form>
		{/if}
	{/if}
</div>

<style>
	.tutor-questions {
		display: grid;
		gap: 0.6rem;
		justify-items: start;
		justify-self: stretch;
	}
	.feedback {
		justify-self: stretch;
		padding: 0.5rem 0.7rem;
		border-radius: 6px;
		background: var(--accent-soft);
		font-size: 0.95rem;
	}
	.feedback p {
		margin: 0;
		white-space: pre-line;
	}
	.feedback .label {
		margin-bottom: 0.2rem;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
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
	.dot {
		width: 0.7rem;
		height: 0.7rem;
		padding: 0;
		border: 1.5px solid var(--muted);
		border-radius: 50%;
		background: none;
		box-shadow: none;
	}
	.dot.done {
		border-color: var(--accent);
		background: var(--accent);
	}
	.dot[aria-current='step'] {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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
		font-weight: 600;
		white-space: pre-line;
	}
	textarea {
		width: 100%;
		font: inherit;
		resize: vertical;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.options button[aria-pressed='true'] {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
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
	.link {
		padding: 0;
		border: none;
		background: none;
		box-shadow: none;
		color: var(--accent);
		text-decoration: underline;
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
