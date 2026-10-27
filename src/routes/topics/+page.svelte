<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Topics · Reader</title>
</svelte:head>

<h1>Topics</h1>
<p class="lede">Subjects you like reading about, in English. Suggestions in every Language look for articles on these.</p>

<div class="card">
{#if data.topics.length === 0}
	<p class="note">No Topics yet: Suggestions are random articles.</p>
{:else}
	<ul class="topics">
		{#each data.topics as topic (topic.id)}
			<li>
				{topic.text}
				<form method="POST" action="?/remove" use:enhance>
					<input type="hidden" name="id" value={topic.id} />
					<button aria-label="Remove {topic.text}">✕</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<form method="POST" action="?/add" class="add" use:enhance>
	<input name="text" placeholder="e.g. football, Roman history" aria-label="New Topic" autocomplete="off" required />
	<button>Add Topic</button>
</form>
{#if form?.message}
	<p class="error" role="alert">{form.message}</p>
{/if}
</div>

<style>
	.topics {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0 0 1.25rem;
		padding: 0;
		list-style: none;
	}
	.topics li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.3rem 0.2rem 0.6rem;
		border-radius: 1rem;
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 500;
	}
	.topics button {
		padding: 0 0.35rem;
		border: none;
		background: none;
		color: inherit;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.add input {
		flex: 1 1 16rem;
		max-width: 28rem;
	}
	.card > .note {
		margin-top: 0;
	}
	.note {
		color: var(--muted);
	}
	.error {
		color: var(--danger);
	}
</style>
