<script lang="ts">
	import Grades from '#lib/components/Grades.svelte';
	import { statusLabels } from '#lib/terms.ts';
	import Due from '#lib/components/Due.svelte';
	import { holdsLabel } from '#lib/practice.ts';
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
	<p><Due {practice} /></p>
	{#if practice.recall}
		<p class="recall">
			Recall: <strong>{statusLabels[practice.recall.level]}</strong>
			<span class="muted">({holdsLabel(practice.recall)})</span>
		</p>
	{:else}
		<p class="recall muted">No Reviews yet.</p>
	{/if}
	<Grades ongrade={onreview} label="Review" />
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
</style>
