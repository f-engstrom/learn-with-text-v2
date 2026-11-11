<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Button from './Button.svelte';
	import Count from './Count.svelte';

	const { Story } = preview.meta({ title: 'Components/Button' });
</script>

<Story name="Variants">
	{#snippet template()}
		<p style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem">
			<Button>Find others</Button>
			<Button variant="primary">Save</Button>
			<Button variant="danger">Delete Term</Button>
			<Button variant="quiet">Later</Button>
			<Button variant="link">Ask the Tutor instead</Button>
		</p>
	{/snippet}
</Story>

<Story name="Disabled">
	{#snippet template()}
		<p style="display: flex; gap: 0.5rem">
			<Button disabled>Next</Button>
			<Button variant="primary" disabled>Send answer</Button>
		</p>
	{/snippet}
</Story>

<Story name="With its key">
	{#snippet template()}
		<p style="display: flex; gap: 0.5rem">
			<Button variant="primary" key="Space">Reveal</Button>
			<Button key="Esc">Back to reading</Button>
		</p>
	{/snippet}
</Story>

<Story name="A toggle, off and on">
	{#snippet template()}
		<p style="display: flex; gap: 0.4rem">
			<Button pressed={false}>Due</Button>
			<Button pressed>Zen</Button>
		</p>
	{/snippet}
</Story>

<Story name="With a Count">
	{#snippet template()}<Button>Practice<Count value={4} /></Button>{/snippet}
</Story>

<Story name="As a link">
	{#snippet template()}
		<p style="display: flex; gap: 0.5rem">
			<Button href="/books/1/pages/1">← Previous</Button>
			<Button href="/books/new" variant="primary">New Book</Button>
		</p>
	{/snippet}
</Story>
