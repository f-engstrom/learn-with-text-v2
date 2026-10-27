<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Topics · Reader</title>
</svelte:head>

<p><a href="/">← Books</a></p>
<h1>Topics</h1>
<p>Subjects you like reading about, in English. Suggestions in every Language look for articles on these.</p>

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

<style>
	.topics {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0;
		list-style: none;
	}
	.topics li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.3rem 0.2rem 0.6rem;
		border-radius: 1rem;
		background: #eef2f8;
	}
	.topics button {
		border: none;
		background: none;
		cursor: pointer;
	}
	.add {
		display: flex;
		gap: 0.5rem;
	}
	.note {
		color: #555;
	}
	.error {
		color: #b00020;
	}
</style>
