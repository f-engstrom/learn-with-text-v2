<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let adding = $state(false);
</script>

<svelte:head>
	<title>Feeds · Reader</title>
</svelte:head>

<h1>Feeds</h1>
<p class="lede">News feeds per Language. Their latest articles show up among the Suggestions, ranked like the rest.</p>

{#each data.languages as language (language.id)}
	{@const feeds = data.feeds.filter((f) => f.languageId === language.id)}
	<h2>{language.name}</h2>
	{#if feeds.length === 0}
		<p class="note">No Feeds.</p>
	{:else}
		<ul class="feeds card">
			{#each feeds as feed (feed.id)}
				<li>
					<span class="name">
						<strong lang={language.code} dir="auto">{feed.name}</strong>
						<small><a href={feed.url} target="_blank" rel="noreferrer">{feed.url}</a></small>
					</span>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="id" value={feed.id} />
						<button aria-label="Remove {feed.name}">Remove</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
{/each}

<h2>Add a Feed</h2>
<form
	method="POST"
	action="?/add"
	class="add card"
	use:enhance={() => {
		adding = true;
		return async ({ update }) => {
			await update();
			adding = false;
		};
	}}
>
	<label>
		Language
		<select name="languageId">
			{#each data.languages as language (language.id)}
				<option value={language.id} selected={form?.values?.languageId === language.id}>{language.name}</option>
			{/each}
		</select>
	</label>
	<label>
		Feed address
		<input name="url" type="url" required placeholder="https://…/rss.xml" value={form?.values?.url ?? ''} autocomplete="off" />
	</label>
	<label>
		Name <small>(optional: the feed's own title is used)</small>
		<input name="name" value={form?.values?.name ?? ''} autocomplete="off" />
	</label>
	<button disabled={adding}>{adding ? 'Reading the feed…' : 'Add Feed'}</button>
</form>
{#if form?.message}
	<p class="error" role="alert">{form.message}</p>
{/if}

<style>
	.feeds {
		display: grid;
		margin: 0;
		padding-block: 0.25rem;
		list-style: none;
	}
	.feeds li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.6rem;
	}
	.feeds li + li {
		border-top: 1px solid var(--border);
	}
	.name {
		display: grid;
		min-width: 0;
	}
	.feeds small {
		overflow-wrap: anywhere;
	}
	.feeds small a {
		color: inherit;
	}
	.feeds button {
		color: var(--danger);
	}
	.add {
		display: grid;
		gap: 0.75rem;
		max-width: 36rem;
	}
	.add button {
		justify-self: start;
	}
	.note {
		color: var(--muted);
	}
	.error {
		color: var(--danger);
	}
</style>
