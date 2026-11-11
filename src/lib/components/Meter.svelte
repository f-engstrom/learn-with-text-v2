<!-- A share as a thin bar: of a Book's Words that are Unknown, of the way to the next Milestone. -->
<script lang="ts">
	interface Props {
		/** From 0 to 1. */
		value: number;
		/** What the bar shows, for a screen reader; without it the bar is decoration beside a figure that says it. */
		label?: string;
		/** A short bar in a line of text, fainter, instead of one as wide as its column. */
		inline?: boolean;
	}

	let { value, label, inline = false }: Props = $props();
</script>

<span class="meter" class:inline role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}
	><span style:width="{Math.min(1, Math.max(0, value)) * 100}%"></span></span
>

<style>
	.meter {
		display: block;
		height: 0.3rem;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
	}
	.inline {
		display: inline-block;
		width: 4rem;
		height: 0.35rem;
	}
	.inline span {
		border-radius: 0;
		opacity: 0.6;
	}
</style>
