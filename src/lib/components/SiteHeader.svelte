<!-- The bar over every screen: the Reader's name and its sections, the one you're in marked. -->
<script lang="ts">
	interface Props {
		/** The address's path, which says which section is current. */
		path: string;
	}

	let { path }: Props = $props();

	const sections = [
		{ href: '/', label: 'Books', matches: (path: string) => path === '/' || path.startsWith('/books') || path.startsWith('/languages') },
		{ href: '/terms', label: 'Terms', matches: (path: string) => path.startsWith('/terms') },
		{ href: '/progress', label: 'Progress', matches: (path: string) => path.startsWith('/progress') },
		{ href: '/topics', label: 'Topics', matches: (path: string) => path.startsWith('/topics') },
		{ href: '/feeds', label: 'Feeds', matches: (path: string) => path.startsWith('/feeds') },
		{ href: '/you', label: 'You', matches: (path: string) => path.startsWith('/you') }
	];
</script>

<header class="site">
	<div class="inner">
		<a class="brand" href="/">Reader</a>
		<nav aria-label="Sections">
			{#each sections as section (section.href)}
				<a href={section.href} aria-current={section.matches(path) ? 'page' : undefined}>{section.label}</a>
			{/each}
		</nav>
	</div>
</header>

<style>
	.inner {
		max-width: var(--width);
		margin: 0 auto;
		padding-inline: var(--gutter);
	}
	.site {
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.site .inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 2.5rem;
		min-height: 4rem;
	}
	.brand {
		color: var(--text);
		font-family: var(--font-text);
		font-weight: 600;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
		text-decoration: none;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-self: stretch;
	}
	/* Each section is as tall as the bar, so the current one's underline sits on the bar's edge. */
	nav a {
		display: flex;
		align-items: center;
		padding: 0 0.75rem;
		color: var(--muted);
		text-decoration: none;
		font-size: 0.9375rem;
		font-weight: 500;
	}
	nav a:hover {
		color: var(--text);
	}
	nav a[aria-current='page'] {
		color: var(--text);
		box-shadow: inset 0 -2px 0 var(--accent);
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
			padding: 0 0.55rem;
			white-space: nowrap;
		}
		/* Books already leads home; the room goes to the sections. */
		.brand {
			display: none;
		}
	}
</style>
