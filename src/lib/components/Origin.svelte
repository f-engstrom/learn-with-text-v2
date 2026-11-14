<!--
	A Term's Origin: its chain of sources, nearest first, each with its kind ("← loanword Turkish čorap",
	"← derived Persian jurāb"), then its cognates ("~ cognate English loaf"), and the note beneath. A language that is one of Your
	languages is marked, since that is a bridge you already have.
-->
<script lang="ts">
	import type { Origin } from '#lib/server/domain/terms.ts';
	import { originArrow, originKindLabels } from '#lib/terms.ts';
	import SourceTag from './SourceTag.svelte';

	interface Props {
		origin: Origin;
		/** The names of Your languages. */
		yourLanguages?: string[];
		/** Whether to show the note; Practice shows only the links. */
		note?: boolean;
		/** Whether to show its Source; not where it is plain (Wiktionary's own suggestions). */
		sourced?: boolean;
	}

	let { origin, yourLanguages = [], note = true, sourced = true }: Props = $props();

	let chain = $derived(origin.links.filter((l) => l.kind !== 'cognate'));
	let cognates = $derived(origin.links.filter((l) => l.kind === 'cognate'));
	const yours = (language: string) => yourLanguages.some((y) => y.toLocaleLowerCase() === language.toLocaleLowerCase());
</script>

{#snippet link(l: Origin['links'][number])}
	<span class="link">
		<span class="arrow" aria-hidden="true">{originArrow(l.kind)}</span>
		<span class="kind">{originKindLabels[l.kind].toLocaleLowerCase()}</span>
		<span class={['language', yours(l.language) && 'yours']} title={yours(l.language) ? 'One of your languages' : undefined}
			>{l.language}</span
		>{#if l.word}{' '}<i class="word">{l.word}</i>{/if}
	</span>
{/snippet}

<div class="origin">
	{#if chain.length > 0}
		<p class="chain">{#each chain as l, i (i)}{@render link(l)}{/each}</p>
	{/if}
	{#if cognates.length > 0}
		<p class="cognates">{#each cognates as l, i (i)}{@render link(l)}{/each}</p>
	{/if}
	{#if note && origin.note}
		<p class="note">{origin.note}</p>
	{/if}
	{#if origin.of || (sourced && origin.source !== 'you')}
		<p class="about">
			{#if origin.of}<span>From its Parent, {origin.of}</span>{/if}
			{#if sourced}<SourceTag source={origin.source} />{/if}
		</p>
	{/if}
</div>

<style>
	.origin {
		display: grid;
		gap: 0.15rem;
	}
	p {
		margin: 0;
	}
	.chain,
	.cognates {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.6rem;
	}
	.link {
		white-space: nowrap;
	}
	.arrow {
		color: var(--muted);
		margin-inline-end: 0.2rem;
	}
	.kind {
		margin-inline-end: 0.25rem;
		color: var(--muted);
		font-size: 0.8em;
	}
	.language.yours {
		color: var(--accent);
		font-weight: 600;
	}
	.note {
		color: var(--muted);
		font-size: 0.85em;
		line-height: 1.4;
	}
	.about {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.85em;
	}
</style>
