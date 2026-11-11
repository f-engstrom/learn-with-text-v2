<!-- The Status and Due colours where they carry meaning: on Words, in both schemes. -->
<script lang="ts">
	import Word from '../../routes/books/[bookId]/pages/[position]/Word.svelte';
	import { statusLabels, STATUSES } from '#lib/terms.ts';

	const statuses = ['unknown', ...STATUSES] as const;
	const label = (status: (typeof statuses)[number]) => (status === 'unknown' ? 'Unknown' : statusLabels[status]);
	const sentence = ['Говорили', 'что', 'на', 'набережной', 'появилось', 'новое', 'лицо'];
	const sample = ['known', 'known', 'known', 'learning1', 'learning2', 'unknown', 'learning4'] as const;
	const due = [0, 0, 0, 3, 1, 0, 2] as const;
</script>

{#each ['light', 'dark'] as const as scheme (scheme)}
	<section style:color-scheme={scheme}>
		<h2>{scheme === 'light' ? 'Light' : 'Dark'}</h2>
		<table>
			<thead>
				<tr><th>Status</th><th>In the text</th><th>The cursor on it</th><th>Due</th><th>Overdue</th><th>Long overdue</th></tr>
			</thead>
			<tbody>
				{#each statuses as status (status)}
					<tr>
						<th>{label(status)}</th>
						<td class="text"><Word text="набережной" {status} /></td>
						<td class="text"><Word text="набережной" {status} current /></td>
						{#each [1, 2, 3] as const as overdue (overdue)}
							<td class="text"><Word text="набережной" {status} due={overdue} /></td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="text">
			{#each sentence as text, i (i)}<Word {text} status={sample[i]} due={due[i]} />{' '}{/each}: дама с собачкой.
		</p>
	</section>
{/each}

<style>
	section {
		margin-bottom: 1.5rem;
		padding: 0.5rem 1.5rem 1rem;
		border-radius: var(--radius-lg);
		background: var(--bg);
		color: var(--text);
	}
	table {
		border-collapse: collapse;
	}
	th {
		padding: 0.2rem 1.5rem 0.2rem 0;
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 600;
		text-align: start;
	}
	td {
		padding: 0.1rem 1.5rem 0.1rem 0;
	}
	.text {
		font-family: var(--font-text);
		font-size: 1.32rem;
		line-height: 2;
	}
</style>
