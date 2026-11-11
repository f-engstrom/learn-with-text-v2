<!-- The base controls and classes of app.css, as every screen gets them. -->
<script lang="ts">
	import Tag from '#lib/components/Tag.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
</script>

<h2>Buttons</h2>
<p class="row">
	<button>Button</button>
	<button class="primary">Primary</button>
	<button class="danger">Danger</button>
	<button disabled>Disabled</button>
	<button class="primary" disabled>Primary disabled</button>
	<a class="button" href="#top">Link as button</a>
	<button>Next <kbd>→</kbd></button>
</p>
<p class="row">
	<button class="quiet">Quiet</button>
	<button class="link">Link-like</button>
	<button class="toggle" aria-pressed="false">Toggle off</button>
	<button class="toggle" aria-pressed="true">Toggle on</button>
</p>

<h2>Fields</h2>
<div class="fields">
	<label>Text <input value="Съешь же ещё" /></label>
	<label>Empty <input placeholder="Placeholder" /> <small>A hint under the field.</small></label>
	<label>
		Select
		<select><option>Learning 1</option><option>Known</option></select>
	</label>
	<label>Textarea <textarea rows="3">Several lines
of text</textarea></label>
	<p class="row">
		<label class="inline"><input type="checkbox" checked /> Checkbox</label>
		<label class="inline"><input type="radio" checked /> Radio</label>
	</p>
</div>

<h2>Card, tags and keys</h2>
<div class="card">
	<p>A card. <Tag>Tag</Tag> <Tag tone="accent">Wiktionary</Tag></p>
	<p class="muted">Press <kbd>Space</kbd> or <kbd>Esc</kbd>.</p>
</div>

<h2>Page header</h2>
<PageHeader title="Terms">
	<button class="primary">Review</button>
	{#snippet lede()}The lede says what the screen is for.{/snippet}
</PageHeader>

<h2>Data table</h2>
<div class="table-wrap">
	<table class="data">
		<thead>
			<tr><th>Term</th><th>Translation</th><th class="number">Reviews</th></tr>
		</thead>
		<tbody>
			<tr><td>булка</td><td>bun</td><td class="number">12</td></tr>
			<tr><td>мягкий</td><td>soft</td><td class="number">3</td></tr>
			<tr><td>чай</td><td>tea</td><td class="number">140</td></tr>
		</tbody>
	</table>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.fields {
		display: grid;
		gap: 1rem;
		max-width: 24rem;
	}
	.inline {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
</style>
