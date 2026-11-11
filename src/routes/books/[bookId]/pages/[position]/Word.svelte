<!-- A Word (or a matched Multi-word Term) in the Page's text: marked by its Status, and by where the Selection, the Highlight and practice are. -->
<script lang="ts">
	import type { Status } from '#lib/server/domain/terms.ts';

	interface Props {
		/** As written. */
		text: string;
		status: Status | 'unknown';
		/** The cursor is on it. */
		current?: boolean;
		/** Part of the selected phrase. */
		phrase?: boolean;
		/** A Multi-word Term. */
		multi?: boolean;
		/** In the passage the Tutor's Highlight points at. */
		inPassage?: boolean;
		/** Its Due mark: 1 Due, 2 overdue, 3 long overdue; 0 for none. */
		due?: 0 | 1 | 2 | 3;
		/** Zen mode: its Translations, shown under it. */
		gloss?: string;
		/** The one Word the Tab key lands on. */
		tabStop?: boolean;
		/** Enter and Space choose it, except during a Practice run. */
		keys?: boolean;
		/** Clicked or chosen by key; `shift` extends the Selection to it. */
		onchoose?: (shift: boolean) => void;
		element?: HTMLElement;
	}

	let {
		text,
		status,
		current = false,
		phrase = false,
		multi = false,
		inPassage = false,
		due = 0,
		gloss = '',
		tabStop = false,
		keys = true,
		onchoose,
		element = $bindable()
	}: Props = $props();

	/** Shifts the zen tooltip sideways so it stays on screen under a Word near either edge. */
	function keepInView(node: HTMLElement, _text: string) {
		// A margin, not a transform: a transformed box still widens the page from where it was laid out.
		const side = getComputedStyle(node).direction === 'rtl' ? 'marginRight' : 'marginLeft';
		const place = () => {
			node.style[side] = '';
			const box = node.getBoundingClientRect();
			const margin = 8;
			const width = document.documentElement.clientWidth;
			let shift = 0;
			if (box.right > width - margin) shift = width - margin - box.right;
			if (box.left + shift < margin) shift = margin - box.left;
			node.style[side] = `${side === 'marginRight' ? -shift : shift}px`;
		};
		place();
		return { update: place };
	}
</script>

<span
	role="button"
	tabindex={tabStop ? 0 : -1}
	class="word status-mark status-{status} {due ? `due-${due}` : ''}"
	class:current
	class:phrase
	class:multi
	class:in-passage={inPassage}
	data-due={due || undefined}
	bind:this={element}
	onmousedown={(e) => e.shiftKey && e.preventDefault()}
	onclick={(e) => onchoose?.(e.shiftKey)}
	onkeydown={(e) => keys && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onchoose?.(false))}
	>{text}{#if gloss}<span class="gloss" aria-hidden="true" use:keepInView={gloss}>{gloss}</span>{/if}</span
>

<style>
	/* An inline span, not a button: a button would let a line break before the punctuation after it.
	   Its Status marks come from app.css (status-mark). */
	.word {
		position: relative;
		padding: 0.02em 0.06em;
		border-radius: 0.2em;
		cursor: pointer;
	}
	.word:focus {
		outline: none;
	}
	/* Above its neighbours, so a tooltip under it isn't covered by the next line's Words. */
	.word.current {
		z-index: 2;
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.word.phrase {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
	}
	/* A Multi-word Term reads as one unit. */
	.word.multi {
		text-decoration: underline dotted var(--muted);
		text-underline-offset: 0.25em;
	}
	.word.status-ignored {
		color: var(--status-ignored);
	}
	/* In the Tutor's Highlight: the same band as the text around it (see PageText); an Unknown Word keeps its fill. */
	.word.in-passage:not(.status-unknown) {
		--fill: var(--highlight);
		border-radius: 0;
	}
	/* A Due Word: a dot over its end in its Due colour, amber when just Due, red when long overdue. */
	.word[data-due]::after {
		content: '';
		position: absolute;
		top: -0.12em;
		inset-inline-end: -0.12em;
		width: 0.36em;
		height: 0.36em;
		border-radius: 50%;
		background: var(--due);
		box-shadow: 0 0 0 1.5px var(--bg);
		pointer-events: none;
	}
	/* Zen mode: the tapped Word's Translations, under it. */
	.gloss {
		position: absolute;
		top: calc(100% + 0.3rem);
		inset-inline-start: 0;
		z-index: 1;
		width: max-content;
		max-width: min(18rem, calc(100vw - 1rem));
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
		font: 1rem/1.4 var(--font-ui);
		pointer-events: none;
	}
</style>
