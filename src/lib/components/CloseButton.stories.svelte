<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import CloseButton from './CloseButton.svelte';

	const { Story } = preview.meta({
		title: 'Components/Close button',
		component: CloseButton,
		args: { label: 'Close', onclick: fn() }
	});
</script>

<Story name="In the corner of a card" args={{ label: 'Stop practising' }}>
	{#snippet template(args)}
		<div class="card" style="position: relative; max-width: 20rem">
			<h3 style="margin: 0">Practice</h3>
			<p>The card it closes holds it in its corner.</p>
			<CloseButton {...args} />
		</div>
	{/snippet}
</Story>

<Story name="In a row" args={{ label: 'Put the Tutor aside', title: 'Until the Tutor asks again', inline: true }}>
	{#snippet template(args)}
		<p style="display: flex; align-items: center; gap: 0.5rem; max-width: 20rem">
			<strong style="flex: 1">Tutor</strong>
			<button type="button" class="quiet">Later</button>
			<CloseButton {...args} />
		</p>
	{/snippet}
</Story>
