<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<SiteHeader path={page.url.pathname} />

<main class="inner">
	{@render children()}
</main>

<style>
	.inner {
		max-width: var(--width);
		margin: 0 auto;
		padding-inline: var(--gutter);
	}
	main {
		padding-block: 2rem 4rem;
	}
	@media (max-width: 40rem) {
		main {
			padding-block: 1.25rem 3rem;
		}
	}
</style>
