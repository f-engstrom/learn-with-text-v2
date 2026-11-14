<!-- The fields every screen gets from app.css: text, search, address, number, select, textarea,
     checkbox and radio, each with a label above it. They are plain elements, not a component, so
     this story is where a change to their look shows. -->
<script module lang="ts">
	import preview from '../../../.storybook/preview';

	const { Story } = preview.meta({ title: 'Components/Fields' });
</script>

<Story name="Text fields">
	{#snippet template()}
		<div class="fields">
			<label>Text <input value="Съешь же ещё" /></label>
			<label>Empty <input placeholder="e.g. football, Roman history" /></label>
			<label>Search <input type="search" placeholder="Term or Translation" /></label>
			<label>Web address <input type="url" placeholder="https://…/rss.xml" /></label>
			<label>With a hint <input value="Swedish" /> <small>A hint under the field.</small></label>
			<p class="row"><label class="inline"><input type="number" min="0" max="100" value="2" /> %</label></p>
		</div>
	{/snippet}
</Story>

<Story name="Selects">
	{#snippet template()}
		<div class="fields">
			<label>Language <select><option>All</option><option>Russian</option><option>Chinese</option></select></label>
			<label>A long option <select><option>Not Due yet, and no Reviews either</option></select></label>
			<label>Full width <select class="wide"><option>Any</option></select></label>
		</div>
	{/snippet}
</Story>

<Story name="Textarea">
	{#snippet template()}
		<div class="fields">
			<label>Your answer <textarea rows="3">Several lines
of text</textarea></label>
			<label>Empty <textarea rows="2" placeholder="Paste the text here"></textarea></label>
		</div>
	{/snippet}
</Story>

<Story name="Checkbox and radio">
	{#snippet template()}
		<p class="row">
			<label class="inline"><input type="checkbox" checked /> Checked</label>
			<label class="inline"><input type="checkbox" /> Not checked</label>
			<label class="inline"><input type="radio" name="r" checked /> Chosen</label>
			<label class="inline"><input type="radio" name="r" /> Not chosen</label>
		</p>
	{/snippet}
</Story>

<Story name="In a row">
	{#snippet template()}
		<p class="row end">
			<label>Status <select><option>Any</option></select></label>
			<label>Search <input type="search" placeholder="Term or Translation" /></label>
			<button>Filter</button>
		</p>
	{/snippet}
</Story>

<Story
	name="Focused"
	play={async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		canvasElement.querySelector('select')?.focus();
	}}
>
	{#snippet template()}
		<div class="fields">
			<label>Language <select><option>All</option><option>Russian</option></select></label>
			<label>Search <input type="search" placeholder="Term or Translation" /></label>
		</div>
	{/snippet}
</Story>

<Story name="On a phone" globals={{ viewport: { value: 'phone' } }}>
	{#snippet template()}
		<div class="two-up">
			<label>Language <select><option>All</option></select></label>
			<label>Status <select><option>Any</option></select></label>
			<label>Translation Source <select><option>Any</option></select></label>
			<label>Practice <select><option>Not Due yet</option></select></label>
			<label class="span">Search <input type="search" placeholder="Term or Translation" /></label>
		</div>
	{/snippet}
</Story>

<style>
	.fields {
		display: grid;
		gap: 1rem;
		max-width: 24rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.end {
		align-items: end;
	}
	.inline {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.wide {
		width: 100%;
	}
	.two-up {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem 1rem;
	}
	.two-up select,
	.two-up input {
		width: 100%;
	}
	.span {
		grid-column: 1 / -1;
	}
</style>
