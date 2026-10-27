<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fits, goodLength, rankSuggestions, type FitRange } from '#lib/suggestions.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
	let dir: 'rtl' | 'ltr' = $derived(data.language.rightToLeft ? 'rtl' : 'ltr');

	// The Fit range as whole percentages for the inputs; Suggestions re-rank as you change it.
	const initial = () => data.fitRange;
	let min = $state(Math.round(initial().min * 100));
	let max = $state(Math.round(initial().max * 100));
	let range: FitRange = $derived({ min: Math.min(min, max) / 100, max: Math.max(min, max) / 100 });
	let picking = $state<string | undefined>();

	function saveFitRange() {
		const body = new FormData();
		body.set('min', String(min));
		body.set('max', String(max));
		fetch('?/fitRange', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
	}
</script>

<svelte:head>
	<title>Find something to read · {data.language.name} · Reader</title>
</svelte:head>

<h1>Find something to read in {data.language.name}</h1>

<p class="topics lede">
	{#if data.topics.length > 0}
		Looking for: {data.topics.map((t) => t.text).join(', ')}.
	{:else}
		No Topics yet, so these are random Wikipedia articles.
	{/if}
	<a href="/topics">Edit Topics</a>
	<br />
	{#if data.feeds.length > 0}
		Also the latest from {data.feeds.map((f) => f.name).join(', ')}.
	{:else}
		No Feeds for {data.language.name}.
	{/if}
	<a href="/feeds">Edit Feeds</a>
</p>

<fieldset class="fit card">
	<legend>Fit range: Unknown share between</legend>
	<label><input type="number" min="0" max="100" bind:value={min} onchange={saveFitRange} /> %</label>
	and
	<label><input type="number" min="0" max="100" bind:value={max} onchange={saveFitRange} /> %</label>
</fieldset>

{#if form?.message}
	<p class="error" role="alert">{form.message}</p>
{/if}

{#await data.suggestions}
	<p class="note">Looking on Wikipedia and in the Feeds…</p>
{:then result}
	{#if 'failed' in result}
		<p class="error" role="alert">{result.failed}</p>
	{:else if result.found.length === 0}
		<p class="note">Nothing found this time.</p>
	{:else}
		<ol class="suggestions">
			{#each rankSuggestions(result.found, range) as suggestion (suggestion.url)}
				<li class:fits={fits(suggestion, range)}>
					<div class="title">
						<a href={suggestion.url} target="_blank" rel="noreferrer" lang={data.language.code} {dir}>{suggestion.title}</a>
						{#if suggestion.topic}<small class="tag">{suggestion.topic}</small>{/if}
						{#if suggestion.feed}<small class="tag feed">{suggestion.feed}</small>{/if}
					</div>
					<div class="facts">
						<span class="share" title="Share of its distinct Words that are Unknown">{percent.format(suggestion.unknownShare)} Unknown</span>
						<span class:off={!goodLength(suggestion)}>{suggestion.pageCount} {suggestion.pageCount === 1 ? 'Page' : 'Pages'}</span>
					</div>
					<form
						method="POST"
						action="?/pick"
						use:enhance={() => {
							picking = suggestion.url;
							return async ({ update }) => {
								await update();
								picking = undefined;
							};
						}}
					>
						<input type="hidden" name="kind" value={suggestion.feed ? 'feed' : 'wikipedia'} />
						<input type="hidden" name="title" value={suggestion.title} />
						<input type="hidden" name="url" value={suggestion.url} />
						<button class="primary" disabled={picking !== undefined}>{picking === suggestion.url ? 'Importing…' : 'Read this'}</button>
					</form>
				</li>
			{/each}
		</ol>
	{/if}
	<p><button type="button" onclick={() => invalidateAll()}>Find others</button></p>
{/await}

<style>
	.fit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1.5rem;
		padding-block: 0.85rem;
	}
	.fit legend {
		float: left;
		margin-inline-end: 0.5rem;
		padding: 0;
		font-weight: 600;
	}
	.fit label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: normal;
	}
	.fit input {
		width: 4.5rem;
	}
	.suggestions {
		display: grid;
		gap: 0.6rem;
		padding: 0;
		list-style: none;
	}
	.suggestions li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 1.25rem;
		align-items: center;
		padding: 0.85rem 1.1rem;
		border: 1px solid var(--border);
		border-inline-start: 4px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	.title a {
		font-weight: 500;
	}
	.suggestions li.fits {
		border-inline-start-color: var(--ok);
	}
	.facts {
		display: flex;
		gap: 0.75rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.fits .share {
		color: var(--ok);
		font-weight: 600;
	}
	.off {
		color: var(--muted);
	}
	.tag {
		margin-inline-start: 0.4rem;
	}
	.tag.feed {
		background: var(--accent-soft);
		color: var(--accent);
	}
	@media (max-width: 40rem) {
		.suggestions li {
			grid-template-columns: 1fr auto;
		}
		.title {
			grid-column: 1 / -1;
		}
	}
</style>
