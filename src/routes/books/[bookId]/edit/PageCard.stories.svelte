<script module lang="ts">
	import preview from '../../../../../.storybook/preview';
	import PageCard from './PageCard.svelte';
	import type { DraftPage } from '#lib/books/page-draft.svelte.ts';

	const { Story } = preview.meta({ title: 'Components/Edit Book/PageCard', component: PageCard });

	const text = 'Старый мост через реку снова открыт. Его ремонтировали почти два года, и жители города очень ждали этого дня.\n\nУтром на мосту собрались люди.';
	const page = (over: Partial<DraftPage> = {}): DraftPage => ({ key: 'a', id: 1, was: 2, text, readAt: null, removed: false, open: false, ...over });
</script>

{#snippet one(p: DraftPage, props: Record<string, unknown> = {})}
	<ol style="display: grid; gap: 0.5rem; max-width: 48rem; padding: 0">
		<PageCard page={p} text={p.text} number={p.removed ? null : 2} words={24} lang="ru" {...props} />
	</ol>
{/snippet}

<Story name="Closed">{#snippet template()}{@render one(page())}{/snippet}</Story>
<Story name="Read, with the Bookmark">{#snippet template()}{@render one(page({ readAt: '2026-11-10T19:12:00Z' }), { bookmark: true })}{/snippet}</Story>
<Story name="Open">{#snippet template()}{@render one(page({ open: true, readAt: '2026-11-10T19:12:00Z' }))}{/snippet}</Story>
<Story name="Moved, and new">
	{#snippet template()}
		{@render one(page({ was: 5 }))}
		{@render one(page({ key: 'b', id: null, was: null }))}
	{/snippet}
</Story>
<Story name="Splits on Save">{#snippet template()}{@render one(page({ open: true, text: `${text}\n---\nВторая часть.` }))}{/snippet}</Story>
<Story name="Longer than usual">{#snippet template()}{@render one(page(), { words: 640 })}{/snippet}</Story>
<Story name="Removed, was Read">{#snippet template()}{@render one(page({ removed: true, readAt: '2026-11-10T19:12:00Z' }))}{/snippet}</Story>
