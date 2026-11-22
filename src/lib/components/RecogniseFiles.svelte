<!--
  Photos, PDFs and text files whose text is read on the server (Recognise, ADR 0010) and handed to
  the screen's text box one at a time, in the order they were taken or chosen. Each is sent as soon
  as it's added, so the next photo can be taken while the last is read. Their thumbnails stay beside
  the text to check it against, until the box is cleared; a photo that can't be read holds back the
  ones after it until it's tried again or removed, so the order of the text is never mixed up.
-->
<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { RECOGNISABLE } from '#lib/recognise.ts';

	interface Props {
		/** The Language the text is in. */
		languageId: number;
		/** Each file's text, in order. */
		onread: (text: string, file: File) => void;
	}

	let { languageId, onread }: Props = $props();

	interface Item {
		id: number;
		file: File;
		/** An object URL to show a photo by; none for a PDF or text file, or a photo that can't be shown. */
		url?: string;
		/** The photo's URL is the server's JPEG of it, which the browser couldn't show as it was. */
		converted?: boolean;
		state: 'waiting' | 'reading' | 'read' | 'failed';
		message?: string;
	}

	let items = $state<Item[]>([]);
	let shown = $state<Item | null>(null);
	let nextId = 0;
	let busy = false;

	export function clear() {
		for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
		items = [];
		shown = null;
	}

	$effect(() => clear);

	function add(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		for (const file of input.files ?? []) {
			const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
			items.push({ id: nextId++, file, url, state: 'waiting' });
		}
		input.value = '';
		void work();
	}

	/** Reads the waiting files one after another; stops at one that failed. */
	async function work() {
		if (busy) return;
		busy = true;
		try {
			for (;;) {
				const item = items.find((i) => i.state !== 'read');
				if (!item || item.state === 'failed') return;
				item.state = 'reading';
				const body = new FormData();
				body.append('files', item.file);
				try {
					const response = await fetch(`/languages/${languageId}/recognise`, { method: 'POST', body });
					const answer = await response.json().catch(() => ({}));
					if (!response.ok) throw new Error(answer.message ?? `The server answered ${response.status}.`);
					if (!items.includes(item)) continue;
					item.state = 'read';
					onread(answer.text, item.file);
				} catch (e) {
					item.state = 'failed';
					item.message = e instanceof Error ? e.message : String(e);
				}
			}
		} finally {
			busy = false;
		}
	}

	/**
	 * A photo the browser can't show (an iPhone's HEIC outside Safari) is shown by the JPEG the
	 * server makes of it; failing that, by its name.
	 */
	async function unshowable(item: Item) {
		if (item.converted || !item.url) return;
		item.converted = true;
		const original = item.url;
		let url: string | undefined;
		try {
			const body = new FormData();
			body.append('file', item.file);
			const response = await fetch('/recognise/preview', { method: 'POST', body });
			if (response.ok) url = URL.createObjectURL(await response.blob());
		} catch {
			// Shown by its name.
		}
		// Removed, or the box cleared, while it was made.
		if (item.url !== original || !items.includes(item)) {
			if (url) URL.revokeObjectURL(url);
			return;
		}
		URL.revokeObjectURL(original);
		item.url = url;
		if (!url && shown === item) shown = null;
	}

	function retry(item: Item) {
		item.state = 'waiting';
		item.message = undefined;
		void work();
	}

	function remove(item: Item) {
		if (item.url) URL.revokeObjectURL(item.url);
		if (shown === item) shown = null;
		items = items.filter((i) => i !== item);
		void work();
	}

	const label = (item: Item) =>
		({ waiting: 'Waiting', reading: 'Reading…', read: 'Read', failed: "Couldn't read it" })[item.state];
</script>

<div class="recognise">
	<div class="pick">
		<label class="button">
			📷 Photo of text
			<input type="file" accept="image/*" capture="environment" onchange={add} />
		</label>
		<label class="button quiet">
			Choose photos or files
			<input type="file" accept={RECOGNISABLE} multiple onchange={add} />
		</label>
	</div>
	{#if items.length > 0}
		<ol class="items" aria-label="Files to read">
			{#each items as item, i (item.id)}
				<li class={['item', item.state]}>
					<button type="button" class="thumb" aria-label="Show {item.file.name}" aria-pressed={shown === item} onclick={() => (shown = shown === item ? null : item)} disabled={!item.url}>
						{#if item.url}
							<img src={item.url} alt="" onerror={() => unshowable(item)} />
						{:else}
							<span class="name">{item.file.name}</span>
						{/if}
						<span class="number">{i + 1}</span>
					</button>
					<span class="state" role={item.state === 'failed' ? 'alert' : 'status'}>{label(item)}</span>
					{#if item.state === 'failed'}
						<small class="error">{item.message}</small>
						<span class="actions">
							<Button type="button" variant="quiet" onclick={() => retry(item)}>Try again</Button>
							<Button type="button" variant="quiet" onclick={() => remove(item)}>Remove</Button>
						</span>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
	{#if shown?.url}
		<figure>
			<img src={shown.url} alt="Photo {items.indexOf(shown) + 1}, to check the text against" />
			<figcaption>
				<Button type="button" variant="quiet" onclick={() => (shown = null)}>Close</Button>
				<Button type="button" variant="quiet" onclick={() => shown && remove(shown)}>Remove photo</Button>
			</figcaption>
		</figure>
	{/if}
</div>

<style>
	.recognise {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
	}
	.pick {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.pick label {
		position: relative;
	}
	.pick input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.pick label:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.items {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		margin: 0;
		padding: 0 0 0.25rem;
		list-style: none;
	}
	.item {
		display: grid;
		gap: 0.2rem;
		justify-items: start;
		width: 6rem;
		flex: none;
		font-size: 0.8rem;
	}
	.thumb {
		position: relative;
		width: 6rem;
		height: 7.5rem;
		padding: 0;
		overflow: hidden;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--surface);
	}
	.thumb[aria-pressed='true'] {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.thumb .name {
		display: block;
		padding: 0.4rem;
		font-size: 0.75rem;
		overflow-wrap: anywhere;
	}
	.number {
		position: absolute;
		inset-block-start: 0.25rem;
		inset-inline-start: 0.25rem;
		min-width: 1.4em;
		padding: 0 0.3em;
		border-radius: 999px;
		background: var(--bg);
		color: var(--text);
		font-size: 0.75rem;
		text-align: center;
	}
	.waiting .thumb,
	.reading .thumb {
		opacity: 0.6;
	}
	.reading .state {
		color: var(--accent);
	}
	.state {
		color: var(--muted);
	}
	.failed .state {
		color: var(--danger);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
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
		gap: 0.25rem;
	}
</style>
