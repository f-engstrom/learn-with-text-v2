<!-- Beside the text when no Word is selected: how to start, the Keys, and what the colours mean. -->
<script lang="ts">
	import { TOP } from '#lib/reading/practice.svelte.ts';
</script>

<div class="help card">
	<p class="start"><span class="pointer">Click a Word, or press <kbd>→</kbd> to start.</span><span class="touch">Tap a Word to open it.</span></p>
	<details>
		<summary>Keys</summary>
		<dl class="keys">
			<dt><kbd>←</kbd> <kbd>→</kbd></dt>
			<dd>Previous or next Word</dd>
			<dt><kbd>↑</kbd> <kbd>↓</kbd></dt>
			<dd>Previous or next Sentence</dd>
			<dt><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd></dt>
			<dd>Select a phrase (or Shift-click)</dd>
			<dt>Characters</dt>
			<dd>In the Term form, pick part of a Chinese Word</dd>
			<dt><kbd>1</kbd>–<kbd>4</kbd></dt>
			<dd>Learning 1–4</dd>
			<dt><kbd>K</kbd> <kbd>I</kbd></dt>
			<dd>Known, Ignored</dd>
			<dt><kbd>Enter</kbd></dt>
			<dd>Open the Term form</dd>
			<dt><kbd>L</kbd> <kbd>Shift</kbd> + <kbd>L</kbd></dt>
			<dd>Next or previous Dictionary, then none</dd>
			<dt><kbd>P</kbd> <kbd>⌘V</kbd></dt>
			<dd>Paste as Translation</dd>
			<dt><kbd>Esc</kbd></dt>
			<dd>Close</dd>
			<dt><kbd>Z</kbd></dt>
			<dd>Zen mode</dd>
			<dt><kbd>D</kbd></dt>
			<dd>Due marks on or off</dd>
			<dt><kbd>R</kbd></dt>
			<dd>Practise the Due Words</dd>
			<dt><kbd>T</kbd></dt>
			<dd>Answer the Tutor (<kbd>1</kbd>–<kbd>4</kbd> pick, <kbd>←</kbd> <kbd>→</kbd> questions, <kbd>Esc</kbd> back)</dd>
		</dl>
	</details>
	<p class="legend">
		<span class="swatch status-mark status-unknown"></span> Unknown
		<span class="swatch status-mark status-learning1"></span> 1
		<span class="swatch status-mark status-learning2"></span> 2
		<span class="swatch status-mark status-learning3"></span> 3
		<span class="swatch status-mark status-learning4"></span> 4
		<span class="swatch status-mark status-known"></span> Known
		<span class="due-dot"></span> Due, top {TOP}
	</p>
</div>

<style>
	.help p {
		margin: 0 0 0.75rem;
	}
	.help summary {
		cursor: pointer;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}
	.keys {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 1rem;
		margin: 0 0 1rem;
		font-size: 0.9rem;
	}
	.keys dt {
		white-space: nowrap;
	}
	.keys dd {
		margin: 0;
		color: var(--muted);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.4rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.swatch {
		display: inline-block;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 0.2rem;
		margin-inline-start: 0.35rem;
	}
	.swatch.status-known {
		border: 1px solid var(--border);
	}
	.due-dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		margin-inline-start: 0.35rem;
		border-radius: 50%;
		background: var(--due-2);
	}
	.start .touch {
		display: none;
	}
	/* A touch screen has no keys to list. */
	@media (hover: none) and (pointer: coarse) {
		.start .pointer,
		.help details {
			display: none;
		}
		.start .touch {
			display: inline;
		}
	}
	@media (max-width: 60rem) {
		.help details:not([open]) + .legend,
		.help {
			font-size: 0.95rem;
		}
	}
</style>
