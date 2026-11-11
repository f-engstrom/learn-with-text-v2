<!-- When a Term is Due, in words: "Due tomorrow", "2 days overdue", coloured by how overdue it is. -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { dueLabel } from '#lib/practice.ts';
	import type { PracticeView } from '#lib/server/domain/practice.ts';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		practice: PracticeView;
		/** Today, for the label; the clock by default. */
		now?: Date;
	}

	let { practice, now, ...rest }: Props = $props();
</script>

<span {...rest} class={['due', `due-${practice.overdue}`, rest.class]}>{dueLabel(practice, now)}</span>

<style>
	.due {
		color: var(--due-text, inherit);
	}
	.due-3 {
		font-weight: 600;
	}
</style>
