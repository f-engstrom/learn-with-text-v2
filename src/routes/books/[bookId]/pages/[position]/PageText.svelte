<!-- The Page's text: paragraphs of Sentences of Words, with the Tutor's Highlight and, under its paragraph, the Tutor's turn. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HighlightOnPage } from '#lib/reading/highlight.ts';
	import type { Word as PageWord } from '#lib/reading/selection.svelte.ts';
	import type { PageView } from '#lib/server/domain/books.ts';
	import type { Status } from '#lib/server/domain/terms.ts';
	import Word from './Word.svelte';

	interface Props {
		paragraphs: PageView['paragraphs'];
		/** The Page's Language and direction. */
		lang: string;
		dir: 'rtl' | 'ltr';
		/** Zen mode: nothing but the text. */
		zen: boolean;
		/** A Practice run is on. */
		practising: boolean;
		/** The Words answer Enter and Space; not while practising. */
		wordKeys: boolean;
		statusOf: (key: string) => Status | 'unknown';
		/** The Due mark for a Word, 0 for none. */
		overdueOf: (key: string) => 0 | 1 | 2 | 3;
		/** The cursor's Word, by index. */
		current: number | undefined;
		inPhrase: (index: number) => boolean;
		/** Where the Tutor's Highlight falls on this Page. */
		onPage: HighlightOnPage | undefined;
		/** Zen mode: the Translations to show under the Word at `glossAt`. */
		gloss: string;
		glossAt: number | undefined;
		/** The Tutor's turn, and the paragraph (by index) it follows; with a turn and no paragraph it opens the Page. */
		turn?: Snippet;
		turnAt: number | undefined;
		onchoose: (word: PageWord, shift: boolean) => void;
	}

	let { paragraphs, lang, dir, zen, practising, wordKeys, statusOf, overdueOf, current, inPhrase, onPage, gloss, glossAt, turn, turnAt, onchoose }: Props =
		$props();

	let wordElements = $state<HTMLElement[]>([]);
	let highlightElement = $state<HTMLElement>();

	/** The element of the Word at `index`, to focus it or scroll it into view. */
	export function word(index: number): HTMLElement | undefined {
		return wordElements[index];
	}

	/** Where the Highlight starts, to scroll to it. */
	export function highlightStart(): HTMLElement | undefined {
		return highlightElement;
	}

	/** The index on the Page of each paragraph's first Sentence. */
	let firstSentence = $derived.by(() => {
		let count = 0;
		return paragraphs.map((paragraph) => (count += paragraph.sentences.length) - paragraph.sentences.length);
	});
	/** A whole Sentence underlined: when the Highlight has no passage. */
	const highlighted = (sentence: number) => !onPage?.tokens && !!onPage?.sentences.has(sentence);
	const inPassage = (sentence: number, token: number) => !!onPage?.tokens?.has(`${sentence}:${token}`);
</script>

<article class="page" class:zen class:practising {lang} {dir}>
	{#if turn && turnAt === undefined}{@render turn()}{/if}
	{#each paragraphs as paragraph, p (p)}
		<p class:anchor={p === turnAt}>
			{#each paragraph.sentences as sentence, s (s)}
				{@const index = firstSentence[p] + s}
				{#if index === onPage?.first}<span class="highlight-start" bind:this={highlightElement}></span>{/if}<span
					class="sentence"
					class:highlighted={highlighted(index)}
				>
					{#each sentence.tokens as token, t (t)}
						{#if token.key !== undefined && token.index !== undefined}{@const w = token as PageWord}<Word
								text={w.text}
								status={statusOf(w.key)}
								current={current === w.index}
								phrase={inPhrase(w.index)}
								multi={(w.words ?? 1) > 1}
								inPassage={inPassage(index, t)}
								due={overdueOf(w.key)}
								gloss={glossAt === w.index ? gloss : ''}
								tabStop={w.index === (current ?? 0)}
								keys={wordKeys}
								onchoose={(shift) => onchoose(w, shift)}
								bind:element={wordElements[w.index]}
							/>{:else if inPassage(index, t)}<span class="in-passage">{token.text}</span>{:else}{token.text}{/if}
					{/each}
				</span>
			{/each}
		</p>
		{#if turn && p === turnAt}{@render turn()}{/if}
	{/each}
</article>

<style>
	.page {
		grid-area: page;
		font-family: var(--font-text);
		font-size: 1.32rem;
		line-height: 2;
		letter-spacing: 0.003em;
	}
	.page p {
		margin: 0 0 1.1em;
	}
	.page:not(.zen) :global(.word:hover) {
		filter: brightness(0.96);
	}
	/* The Tutor's Highlight, whole Sentences or a passage: a warm band behind the text, each line's piece rounded. */
	.sentence.highlighted {
		padding: 0.12em 0.2em;
		border-radius: 0.3em;
		background: var(--highlight);
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}
	.in-passage {
		background: var(--highlight);
	}
	.highlight-start {
		scroll-margin: 6rem;
	}
	/* While you answer the Tutor, the rest of the Page steps back. */
	.page > p {
		transition: opacity 0.3s;
	}
	.page:has(:global(.turn:focus-within)) > p:not(.anchor) {
		opacity: 0.5;
	}
	/* Zen mode: nothing but the text, plain and a little larger. */
	.page.zen {
		font-size: 1.45rem;
		line-height: 2.05;
	}
	.page.zen :global(.word) {
		background: transparent;
		color: inherit;
	}
	.page.zen :global(.word.multi) {
		text-decoration: none;
	}
	.page.zen :global(.in-passage),
	.page.zen .sentence.highlighted {
		background: transparent;
	}
	.page.zen :global(.word[data-due]::after) {
		display: none;
	}
	/* The keyboard's place: a quiet tint rather than an outline. */
	.page.zen :global(.word.current) {
		outline: none;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.page.zen :global(.turn) {
		display: none;
	}
	@media (max-width: 40rem) {
		.page.zen {
			font-size: 1.28rem;
			line-height: 1.9;
		}
	}
	@media (max-width: 60rem) {
		/* Keeps the practised Word above the practice panel docked at the bottom. */
		.page.practising :global(.word) {
			scroll-margin: 5rem 0 50vh;
		}
	}
</style>
