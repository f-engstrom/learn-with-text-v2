<script lang="ts">
	import { readTokens } from '../tokens';

	const colours = readTokens().filter((token) => token.kind === 'colour');
	const groups = [
		{ title: 'Surfaces and text', match: (name: string) => !/^--(status|due)/.test(name) },
		{ title: 'Status', match: (name: string) => name.startsWith('--status') },
		{ title: 'Due marks', match: (name: string) => name.startsWith('--due') }
	].map((group) => ({ ...group, tokens: colours.filter((token) => group.match(token.name)) }));

	/** The two halves of `light-dark(a, b)`. */
	function halves(value: string): [string, string] {
		const [light, dark] = value.replace(/^light-dark\(|\)$/g, '').split(/,\s*/);
		return [light, dark ?? light];
	}
</script>

{#each groups as group (group.title)}
	<h2>{group.title}</h2>
	<table class="data">
		<thead>
			<tr><th>Token</th><th>Light</th><th>Dark</th></tr>
		</thead>
		<tbody>
			{#each group.tokens as token (token.name)}
				{@const [light, dark] = halves(token.value)}
				<tr>
					<td>
						<code>{token.name}</code>
						{#if token.note}<br /><small>{token.note}</small>{/if}
					</td>
					<!-- color-scheme on the cell decides which half of light-dark() the swatch shows. -->
					<td class="scheme" style:color-scheme="light">
						<span class="swatch" style:background="var({token.name})"></span><code>{light}</code>
					</td>
					<td class="scheme" style:color-scheme="dark">
						<span class="swatch" style:background="var({token.name})"></span><code>{dark}</code>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/each}

<style>
	.scheme {
		background: var(--bg);
		color: var(--text);
		white-space: nowrap;
	}
	.swatch {
		display: inline-block;
		width: 3rem;
		height: 1.6rem;
		margin-inline-end: 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		vertical-align: middle;
	}
	code {
		font-size: 0.8rem;
	}
</style>
