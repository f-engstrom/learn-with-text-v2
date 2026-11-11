<!-- A whole screen as the Reader shows it: a route's page inside the layout, given the data its load would return. -->
<script lang="ts">
	import type { Component } from 'svelte';
	import Layout from '../routes/+layout.svelte';

	interface Props {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		screen: Component<any>;
		data: unknown;
		/** What a form action answered, if the story is of that moment. */
		form?: unknown;
	}

	let { screen: Page, data, form = null }: Props = $props();
</script>

<Layout data={{}} params={{}}>
	<Page {data} {form} params={{}} />
</Layout>
