<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.book.title} · Reader</title>
</svelte:head>

<p><a href="/">← Books</a></p>
<h1 lang={data.language.code} dir={data.language.rightToLeft ? 'rtl' : 'ltr'}>{data.book.title}</h1>
<p><small>Page {data.position} of {data.book.pageCount}</small></p>

<article class="page" lang={data.language.code} dir={data.language.rightToLeft ? 'rtl' : 'ltr'}>
	{#each data.paragraphs as paragraph, p (p)}
		<p>
			{#each paragraph.sentences as sentence, s (s)}
				<span class="sentence">
					{#each sentence.tokens as token, t (t)}
						{#if token.isWord}<span class="word unknown">{token.text}</span>{:else}{token.text}{/if}
					{/each}
				</span>
			{/each}
		</p>
	{/each}
</article>

<style>
	.page {
		max-width: 48rem;
		font-size: 1.25rem;
		line-height: 1.9;
	}
	.word {
		border-radius: 0.2em;
		padding: 0 0.05em;
	}
	.unknown {
		background: #d6ebff;
	}
</style>
