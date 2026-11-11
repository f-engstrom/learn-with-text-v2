<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import PageHeader from './PageHeader.svelte';

	const { Story } = preview.meta({
		title: 'Components/Page header',
		component: PageHeader,
		args: { title: 'Progress' }
	});
</script>

<Story name="A title" />

<Story name="With a primary link" args={{ title: 'Terms' }}>
	{#snippet template(args)}
		<PageHeader {...args}><a class="button primary" href="/terms/review">Review Due Terms</a></PageHeader>
	{/snippet}
</Story>

<Story name="With a filter and a lede" args={{ title: 'Review' }}>
	{#snippet template(args)}
		<PageHeader {...args}>
			<label><span class="visually-hidden">Language</span><select><option>All Languages</option><option>Russian</option></select></label>
			{#snippet lede()}12 Due Terms, 3 reviewed this time. <a href="/terms?due=due">See them in the list</a>{/snippet}
		</PageHeader>
	{/snippet}
</Story>

<Story name="On a phone" args={{ title: 'Terms' }} globals={{ viewport: { value: 'phone' } }}>
	{#snippet template(args)}
		<PageHeader {...args}><a class="button primary" href="/terms/review">Review Due Terms</a></PageHeader>
	{/snippet}
</Story>
