<!-- ✕: closes or dismisses what it sits in. In the corner of a card by default; inline sits in a row. -->
<script lang="ts">
	interface Props {
		/** What closing does, for a screen reader: "Stop practising". */
		label: string;
		onclick: () => void;
		title?: string;
		/** In a row (a header, a notice) instead of the corner of the card around it. */
		inline?: boolean;
	}

	let { label, onclick, title, inline = false }: Props = $props();
</script>

<button type="button" class={inline ? 'quiet' : undefined} class:corner={!inline} aria-label={label} {title} {onclick}>✕</button>

<style>
	/* The card it sits in is positioned. */
	.corner {
		position: absolute;
		top: 0.75rem;
		inset-inline-end: 0.75rem;
		padding: 0.2rem 0.5rem;
	}
</style>
