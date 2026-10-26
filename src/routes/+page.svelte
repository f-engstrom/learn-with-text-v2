<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Reader</title>
</svelte:head>

<h1>Reader</h1>

<h2>Languages</h2>
<ul>
	{#each data.languages as language (language.id)}
		<li>
			{language.name}
			<small>({language.code}{language.rightToLeft ? ', right to left' : ''})</small>
		</li>
	{/each}
</ul>
