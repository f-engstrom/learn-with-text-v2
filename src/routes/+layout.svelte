<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const sections = [
		{ href: '/', label: 'Books', matches: (path: string) => path === '/' || path.startsWith('/books') || path.startsWith('/languages') },
		{ href: '/terms', label: 'Terms', matches: (path: string) => path.startsWith('/terms') },
		{ href: '/topics', label: 'Topics', matches: (path: string) => path.startsWith('/topics') },
		{ href: '/feeds', label: 'Feeds', matches: (path: string) => path.startsWith('/feeds') },
		{ href: '/you', label: 'You', matches: (path: string) => path.startsWith('/you') }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="site">
	<div class="inner">
		<a class="brand" href="/">Reader</a>
		<nav aria-label="Sections">
			{#each sections as section (section.href)}
				<a href={section.href} aria-current={section.matches(page.url.pathname) ? 'page' : undefined}>{section.label}</a>
			{/each}
		</nav>
	</div>
</header>

<main class="inner">
	{@render children()}
</main>

<style>
	.inner {
		max-width: var(--width);
		margin: 0 auto;
		padding-inline: var(--gutter);
	}
	.site {
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--bg) 85%, transparent);
		backdrop-filter: blur(8px);
	}
	.site .inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 2rem;
		min-height: 3.5rem;
	}
	.brand {
		color: var(--text);
		font-family: var(--font-text);
		font-style: italic;
		font-weight: 600;
		font-size: 1.3rem;
		letter-spacing: -0.01em;
		text-decoration: none;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	nav a {
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius);
		color: var(--muted);
		text-decoration: none;
		font-weight: 500;
	}
	nav a:hover {
		color: var(--text);
		background: var(--surface-2);
	}
	nav a[aria-current='page'] {
		color: var(--text);
		background: var(--surface-2);
	}
	main {
		padding-block: 2rem 4rem;
	}
	/* A phone: brand and every section on one line, scrolling sideways only if a very narrow screen needs it. */
	@media (max-width: 40rem) {
		.site .inner {
			flex-wrap: nowrap;
			gap: 0.75rem;
			min-height: 3rem;
		}
		nav {
			flex-wrap: nowrap;
			gap: 0;
			overflow-x: auto;
			scrollbar-width: none;
		}
		nav a {
			padding: 0.3rem 0.55rem;
			white-space: nowrap;
		}
		/* Books already leads home; the room goes to the sections. */
		.brand {
			display: none;
		}
		main {
			padding-block: 1.25rem 3rem;
		}
	}
</style>
