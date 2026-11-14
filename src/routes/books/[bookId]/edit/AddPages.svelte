<!--
  Where new Pages can go: between two Page cards, before the first or after the last. A quiet
  "Add Pages here" until used, then a box to paste into, a `---` line between Pages. A photo taken
  there (or picked) shows above the box, for the phone's own text recognition (Live Text, Lens) to
  select and copy from; the Reader reads nothing from it.
-->
<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { splitAtBreaks } from '#lib/pages.ts';

	interface Props {
		/** Open to paste into. */
		open?: boolean;
		/** Always shown, not only on hover: the one at the end. */
		shown?: boolean;
		/** Says where, for screen readers and the button: "after Page 3". */
		where: string;
		lang?: string;
		onopen?: () => void;
		onclose?: () => void;
		onadd?: (text: string) => void;
	}

	let { open = false, shown = false, where, lang, onopen, onclose, onadd }: Props = $props();

	const uid = $props.id();
	let text = $state('');
	const parts = $derived(splitAtBreaks(text).length);

	/** Object URLs of the photos taken here, newest last; gone when the box closes. */
	let photos = $state<string[]>([]);

	function takePhoto(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		for (const file of input.files ?? []) photos.push(URL.createObjectURL(file));
		input.value = '';
	}

	function dropPhoto(url: string) {
		URL.revokeObjectURL(url);
		photos = photos.filter((p) => p !== url);
	}

	function clear() {
		for (const url of photos) URL.revokeObjectURL(url);
		photos = [];
		text = '';
	}

	$effect(() => clear);

	function add() {
		onadd?.(text);
		clear();
	}

	function cancel() {
		clear();
		onclose?.();
	}
</script>

{#if open}
	<li class="card add">
		<div class="head">
			<label for="{uid}-text">Add Pages {where}</label>
			<label class="button photo">
				📷 Photo of text
				<input type="file" accept="image/*" capture="environment" multiple onchange={takePhoto} />
			</label>
		</div>
		{#each photos as url (url)}
			<figure>
				<img src={url} alt="Text to copy from" />
				<figcaption>
					Hold on the text to select it, then copy and paste it below.
					<Button type="button" variant="quiet" onclick={() => dropPhoto(url)}>Remove photo</Button>
				</figcaption>
			</figure>
		{/each}
		<label class="text">
			<span class="visually-hidden">Text</span>
			<!-- svelte-ignore a11y_autofocus -->
			<textarea id="{uid}-text" bind:value={text} rows="4" {lang} dir="auto" autofocus placeholder="Paste or type. A line containing only --- starts a new Page."
			></textarea>
		</label>
		<div class="actions">
			<Button type="button" variant="primary" onclick={add} disabled={parts === 0}>
				{parts > 1 ? `Add ${parts} Pages` : 'Add a Page'}
			</Button>
			<Button type="button" variant="quiet" onclick={cancel}>Cancel</Button>
		</div>
	</li>
{:else}
	<li class={['gap', { shown }]}>
		<button type="button" class="quiet" aria-label="Add Pages {where}" onclick={onopen}>+ Add Pages here</button>
	</li>
{/if}

<style>
	li {
		list-style: none;
	}
	.gap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 0.5rem;
		margin-block: -0.5rem;
		/* Above the cards' shadows, so the line and button aren't hidden under them. */
		position: relative;
		z-index: 1;
	}
	.gap::before,
	.gap::after {
		content: '';
		flex: 1;
		border-top: 1px dashed color-mix(in srgb, var(--accent) 50%, var(--border));
	}
	.gap button {
		padding: 0.1rem 0.6rem;
		border-radius: 999px;
		background: var(--bg);
		color: var(--accent);
		font-size: 0.85rem;
	}
	/* Out of the way until the pointer or focus is there; always there on a touch screen. */
	@media (hover: hover) {
		.gap:not(.shown, :hover, :focus-within) {
			opacity: 0;
		}
	}
	.gap.shown {
		height: auto;
		margin-block: 0.25rem;
	}
	/* A finger needs a row of its own, a full 44px tall, not a line on the cards' edges. */
	@media (pointer: coarse) {
		.gap {
			height: auto;
			margin-block: -0.25rem;
		}
		.gap button {
			min-height: 2.75rem;
			padding-inline: 1rem;
		}
	}
	.add {
		display: grid;
		gap: 0.5rem;
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}
	.add .text {
		display: grid;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.photo input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.photo {
		position: relative;
	}
	.photo:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	figure {
		display: grid;
		gap: 0.25rem;
		margin: 0;
	}
	figure img {
		max-width: 100%;
		max-height: 70vh;
		justify-self: start;
		border-radius: var(--radius);
		border: 1px solid var(--border);
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.add textarea {
		font-family: var(--font-text);
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
