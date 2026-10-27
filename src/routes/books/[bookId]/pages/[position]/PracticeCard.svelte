<script lang="ts">
	import { dueLabel, holdsLabel, levelLabels } from '#lib/practice.ts';
	import type { Grade } from '#lib/server/domain/practice.ts';
	import type { TermView } from '#lib/server/domain/terms.ts';

	interface Props {
		term: TermView;
		onreview: (grade: Grade) => void;
	}

	let { term, onreview }: Props = $props();
	let practice = $derived(term.practice!);
</script>

<!-- A Learning Term's place in practice: when it's Due, its Recall strength, and a Review. -->
<section class="practice" aria-label="Practice">
	<p class="due due-{practice.overdue}">{dueLabel(practice)}</p>
	{#if practice.recall}
		<p class="recall">
			Recall: <strong>{levelLabels[practice.recall.level]}</strong>
			<span class="muted">({holdsLabel(practice.recall)})</span>
		</p>
	{:else}
		<p class="recall muted">No Reviews yet.</p>
	{/if}
	<div class="grades" role="group" aria-label="Review">
		<button type="button" onclick={() => onreview('missed')}>Missed</button>
		<button type="button" onclick={() => onreview('hard')}>Hard</button>
		<button type="button" onclick={() => onreview('got')}>Got it</button>
	</div>
</section>

<style>
	.practice {
		display: grid;
		gap: 0.4rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
	}
	p {
		margin: 0;
	}
	.due {
		font-weight: 600;
	}
	.due-1 {
		color: var(--due-1-text);
	}
	.due-2 {
		color: var(--due-2-text);
	}
	.due-3 {
		color: var(--due-3-text);
	}
	.grades {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
