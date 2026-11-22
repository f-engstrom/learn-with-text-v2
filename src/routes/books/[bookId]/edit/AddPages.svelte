<!--
  Where new Pages can go: between two Page cards, before the first or after the last. A quiet
  "Add Pages here" until used, then a box to paste into, a `---` line between Pages. Photos taken
  there (or picked, or a PDF) are read on the server one at a time and their text added to the box,
  to check against the photos before adding the Pages (ADR 0010).
-->
<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import RecogniseFiles from '#lib/components/RecogniseFiles.svelte';
	import { splitAtBreaks } from '#lib/pages.ts';
	import { appendRecognised } from '#lib/recognise.ts';

	interface Props {
		/** Open to paste into. */
		open?: boolean;
		/** Always shown, not only on hover: the one at the end. */
		shown?: boolean;
		/** Says where, for screen readers and the button: "after Page 3". */
		where: string;
		/** The Book's Language, which photos are read in. */
		languageId: number;
		lang?: string;
		onopen?: () => void;
		onclose?: () => void;
		onadd?: (text: string) => void;
	}

	let { open = false, shown = false, where, languageId, lang, onopen, onclose, onadd }: Props = $props();

	const uid = $props.id();
	let text = $state('');
	const parts = $derived(splitAtBreaks(text).length);
	let files = $state<RecogniseFiles>();

	function clear() {
		files?.clear();
		text = '';
	}

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
		<label for="{uid}-text">Add Pages {where}</label>
		<RecogniseFiles bind:this={files} {languageId} onread={(read) => (text = appendRecognised(text, read))}>
			<label class="text">
				<span class="visually-hidden">Text</span>
				<!-- svelte-ignore a11y_autofocus -->
				<textarea id="{uid}-text" bind:value={text} rows={text ? 12 : 4} {lang} dir="auto" autofocus placeholder="Paste, type, or take a photo of the text. A line containing only --- starts a new Page."
				></textarea>
			</label>
		</RecogniseFiles>
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
	.add textarea {
		font-family: var(--font-text);
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
