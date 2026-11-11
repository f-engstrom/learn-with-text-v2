<script lang="ts">
	import { readTokens } from '../tokens';

	const fonts = readTokens().filter((token) => token.kind === 'font');
	const samples = [
		'The quick brown fox jumps over the lazy dog',
		'Съешь же ещё этих мягких французских булок, да выпей чаю',
		'我能吞下玻璃而不伤身体',
		'من می‌توانم بدونِ احساس درد شیشه بخورم'
	];
</script>

{#each fonts as font (font.name)}
	<section class="card">
		<p class="muted"><code>{font.name}</code>: {font.value}</p>
		{#each samples as sample (sample)}
			<p class="sample" dir="auto" style:font-family="var({font.name})">{sample}</p>
		{/each}
	</section>
{/each}

<h1>Heading one</h1>
<h2>Heading two</h2>
<h3>Heading three</h3>
<p>Body text in the interface font, 17px on a 1.55 line. <a href="#top">A link</a>, <small>small text</small>, and a <span class="muted">muted aside</span>.</p>
<p class="lede">The lede under a page header.</p>
<p class="error">An error message.</p>
<p class="note">A note.</p>

<style>
	section {
		margin-bottom: 1.25rem;
	}
	.sample {
		margin: 0.4rem 0;
		font-size: 1.3rem;
	}
	.lede {
		margin-top: 0;
	}
	code {
		font-size: 0.8rem;
	}
</style>
