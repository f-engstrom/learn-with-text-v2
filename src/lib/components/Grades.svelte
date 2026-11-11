<!-- The three answers to a Review: Missed, Hard, Got it; with their keys where the screen takes them. -->
<script lang="ts">
	import type { Grade } from '#lib/server/domain/practice.ts';

	interface Props {
		ongrade: (grade: Grade) => void;
		/** Shows 1, 2 and 3 on the buttons, where the screen answers those keys. */
		keys?: boolean;
		label?: string;
	}

	let { ongrade, keys = false, label = 'How did it go?' }: Props = $props();

	const grades: { grade: Grade; label: string }[] = [
		{ grade: 'missed', label: 'Missed' },
		{ grade: 'hard', label: 'Hard' },
		{ grade: 'got', label: 'Got it' }
	];
</script>

<div class="grades" role="group" aria-label={label}>
	{#each grades as { grade, label }, i (grade)}
		<button type="button" onclick={() => ongrade(grade)}>{#if keys}<kbd>{i + 1}</kbd>{' '}{/if}{label}</button>
	{/each}
</div>

<style>
	.grades {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
