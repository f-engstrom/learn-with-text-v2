<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import AddForm from './AddForm.svelte';

	const { Story } = preview.meta({ title: 'Components/Add form', component: AddForm });
</script>

<Story name="One field">
	{#snippet template()}
		<AddForm action="?/add" label="Add Topic">
			<input name="text" placeholder="e.g. football, Roman history" aria-label="New Topic" autocomplete="off" />
		</AddForm>
	{/snippet}
</Story>

<Story name="A field and a select">
	{#snippet template()}
		<AddForm action="?/set" label="Add">
			<input name="name" placeholder="e.g. Swedish" aria-label="Language" autocomplete="off" />
			<select name="level" aria-label="How well"><option>Native</option><option selected>Fluent</option><option>Some</option></select>
		</AddForm>
	{/snippet}
</Story>

<Story name="Refused">
	{#snippet template()}
		<AddForm action="?/add" label="Add Topic" message="That Topic is already there.">
			<input name="text" aria-label="New Topic" value="football" autocomplete="off" />
		</AddForm>
	{/snippet}
</Story>
