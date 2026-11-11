<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Due from './Due.svelte';

	const { Story } = preview.meta({ title: 'Components/Due', component: Due });

	const now = new Date('2026-11-11T12:00:00');
	const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString();
</script>

<Story name="Every level">
	{#snippet template()}
		<p style="display: grid; gap: 0.4rem">
			<Due {now} practice={{ due: day(3), overdue: 0, reviews: 2 }} />
			<Due {now} practice={{ due: day(0), overdue: 1, reviews: 2 }} />
			<Due {now} practice={{ due: day(-2), overdue: 2, reviews: 2 }} />
			<Due {now} practice={{ due: day(-9), overdue: 3, reviews: 2 }} />
		</p>
	{/snippet}
</Story>
