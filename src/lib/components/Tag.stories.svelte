<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Tag from './Tag.svelte';

	const { Story } = preview.meta({ title: 'Components/Tag', component: Tag });
</script>

<Story name="Every tone">
	{#snippet template()}
		<p style="display: flex; flex-wrap: wrap; gap: 0.5rem">
			<Tag>Russian</Tag>
			<Tag>Unknown</Tag>
			<Tag tone="accent">Meduza</Tag>
			<Tag tone="ok">Read</Tag>
			<Tag lang="fa" dir="rtl">فارسی</Tag>
		</p>
	{/snippet}
</Story>
