<script lang="ts">
	import { readTokens } from '../tokens';

	const tokens = readTokens();
	const shadows = tokens.filter((token) => token.kind === 'shadow');
	const radii = tokens.filter((token) => token.name.startsWith('--radius'));
	const sizes = tokens.filter((token) => token.kind === 'size' && !token.name.startsWith('--radius'));
</script>

<h2>Radius</h2>
<div class="row">
	{#each radii as token (token.name)}
		<div class="box" style:border-radius="var({token.name})">
			<code>{token.name}</code><small>{token.value}</small>
		</div>
	{/each}
</div>

<h2>Shadow</h2>
<div class="row">
	{#each shadows as token (token.name)}
		<div class="box" style:box-shadow="var({token.name})"><code>{token.name}</code></div>
	{/each}
</div>

<h2>Widths</h2>
{#each sizes as token (token.name)}
	<p><code>{token.name}</code> <small>{token.value}</small></p>
	<div class="bar" style:width="var({token.name})"></div>
{/each}

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		padding: 0.5rem 0 1.5rem;
	}
	.box {
		display: grid;
		place-content: center;
		justify-items: center;
		width: 12rem;
		height: 6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	.bar {
		height: 0.5rem;
		max-width: 100%;
		border-radius: 999px;
		background: var(--accent);
	}
	code {
		font-size: 0.8rem;
	}
</style>
