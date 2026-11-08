import type { Bookmark, PageView, ReadingToken } from '#lib/server/domain/books.ts';
import { characterParts, termKey } from '#lib/normalise.ts';
import { bookmarkedWord } from './bookmark.ts';
import { moveCursor } from './cursor.ts';

/** What the Selection needs of a loaded Page. */
export type Page = Pick<PageView, 'book' | 'language' | 'position' | 'paragraphs'>;
/** A Word, or a matched Multi-word Term, on the Page; `sentence` is its 0-based Sentence on the Page. */
export type Word = ReadingToken & { key: string; index: number; sentence: number };
/** What the Term form and the Status keys act on: one Word, a phrase, or a Character part. */
export type Selected = Pick<Word, 'key' | 'text' | 'sentence'>;

export interface Options {
	/** Moves the Bookmark; by default PUT /books/[id]/bookmark, not waited for. */
	saveBookmark?: (bookId: number, bookmark: Bookmark) => void;
	/** The cursor moved to Word `index`: by a move (focus it) or by resuming at the Bookmark (scroll to it). */
	onMoved?: (index: number, how: 'move' | 'resume') => void;
}

export function saveBookmarkOverHttp(bookId: number, bookmark: Bookmark) {
	fetch(`/books/${bookId}/bookmark`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(bookmark)
	}).catch(() => undefined);
}

const pageKey = (page: Page) => `${page.book.id}/${page.position}`;

/**
 * The Selection on a Page: the cursor, a phrase from an anchor to it, or characters picked within one
 * Chinese Word. The Bookmark follows it, and opening the bookmarked Page resumes at it.
 */
export class Selection {
	#page = $state.raw() as Page;
	words: Word[] = $derived(
		this.#page.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens.filter((t): t is Word => t.key !== undefined)))
	);
	sentences = $derived(this.#page.paragraphs.flatMap((p) => p.sentences));
	/** The Word the keys are on, by index. */
	cursor = $state<number | undefined>();
	/** Where a phrase starts (Shift-click or Shift+arrow); it runs to the cursor. */
	#anchor = $state<number | undefined>();
	/** Characters picked within Word `word`, from `anchor` to `focus`. */
	#part = $state<{ word: number; anchor: number; focus: number }>();
	range = $derived(
		this.cursor === undefined
			? undefined
			: ([Math.min(this.#anchor ?? this.cursor, this.cursor), Math.max(this.#anchor ?? this.cursor, this.cursor)] as const)
	);
	/** The characters of the one selected Word, if it is written in characters you can pick from. */
	characters = $derived(this.range && this.range[0] === this.range[1] ? characterParts(this.words[this.range[0]].text) : undefined);
	/** The picked characters, as a range of their indices. */
	picked = $derived.by(() => {
		const part = this.#part;
		if (!this.characters || !part || part.word !== this.range?.[0]) return undefined;
		return [Math.min(part.anchor, part.focus), Math.max(part.anchor, part.focus)] as const;
	});
	selected: Selected | undefined = $derived.by(() => {
		if (!this.range) return undefined;
		const [first, last] = this.range;
		const sentence = this.words[first].sentence;
		if (first === last && this.characters && this.picked) {
			const text = this.characters.slice(this.picked[0], this.picked[1] + 1).join('');
			return { text, key: termKey(text, this.#page.language), sentence };
		}
		if (first === last) return this.words[first];
		const text = this.#phraseText(first, last) ?? '';
		return { text, key: termKey(text, this.#page.language), sentence };
	});

	#options: Options;
	#key = '';
	/** The Bookmark last saved from here, as "page|sentence|word". */
	#bookmarked = '';

	/** Shows `page` with nothing selected; the first `sync`, in the browser, resumes at the Bookmark. */
	constructor(page: Page, options: Options = {}) {
		this.#options = { saveBookmark: saveBookmarkOverHttp, ...options };
		this.#page = page;
	}

	/**
	 * Takes what a load returned. The first Page, or a new one, resumes at the Bookmark and returns true; the same
	 * Page with its Words regrouped (a Multi-word Term saved or deleted) collapses a phrase to its start.
	 */
	sync(page: Page): boolean {
		const count = this.words.length;
		this.#page = page;
		if (pageKey(page) !== this.#key) {
			this.#enter();
			return true;
		}
		if (this.words.length !== count) {
			if (this.#anchor !== undefined && this.cursor !== undefined) this.cursor = Math.min(this.#anchor, this.cursor);
			this.#anchor = undefined;
			this.#part = undefined;
			if (this.cursor !== undefined && this.cursor >= this.words.length) this.cursor = this.words.length - 1;
			this.#follow();
		}
		return false;
	}

	/** Whether Word `index` is inside a phrase selection. */
	inPhrase(index: number): boolean {
		return this.range !== undefined && this.range[0] < this.range[1] && index >= this.range[0] && index <= this.range[1];
	}

	/** Puts the cursor on Word `index`, as one Word. */
	moveTo(index: number | undefined) {
		this.#anchor = undefined;
		this.#go(index);
	}

	/** The arrow and Sentence keys; Shift+arrow grows the phrase. Returns why a phrase can't grow there. */
	move(command: { kind: 'move' | 'sentence' | 'extend'; by: 1 | -1 }): string | undefined {
		if (command.kind !== 'extend') {
			this.moveTo(moveCursor(this.words, this.cursor, { kind: command.kind, by: command.by }));
			return undefined;
		}
		if (this.cursor === undefined) return undefined;
		return this.extendTo(Math.min(Math.max(this.cursor + command.by, 0), this.words.length - 1));
	}

	/** Grows or shrinks the phrase to end at Word `to`. Returns why it can't, if it can't. */
	extendTo(to: number): string | undefined {
		const from = this.#anchor ?? this.cursor;
		if (from === undefined) {
			this.moveTo(to);
			return undefined;
		}
		if (this.#phraseText(Math.min(from, to), Math.max(from, to)) === undefined) {
			return 'A Multi-word Term stays inside one Sentence, with no punctuation between its Words.';
		}
		this.#anchor = from;
		this.#go(to);
		return undefined;
	}

	/** A click or tap on Word `index`; Shift grows the phrase. Says whether it was the selected Word again. */
	choose(index: number, shift: boolean): { again: boolean; error?: string } {
		const again = this.cursor === index && !shift;
		if (shift && this.cursor !== undefined) {
			const error = this.extendTo(index);
			return error ? { again, error } : { again };
		}
		this.moveTo(index);
		return { again };
	}

	/** Picks character `index` of the selected Word; Shift picks a run from the last one picked. */
	pickCharacter(index: number, shift: boolean) {
		if (!this.range) return;
		const word = this.range[0];
		this.#part = { word, anchor: shift && this.#part?.word === word ? this.#part.anchor : index, focus: index };
		this.#follow();
	}

	/** Back to the whole Word after picking characters. */
	wholeWord() {
		this.#part = undefined;
		this.#follow();
	}

	/** Puts focus back on the cursor's Word, e.g. after closing the Term form. */
	refocus() {
		if (this.cursor !== undefined) this.#options.onMoved?.(this.cursor, 'move');
	}

	#go(index: number | undefined) {
		this.cursor = index;
		this.#follow();
		if (index !== undefined) this.#options.onMoved?.(index, 'move');
	}

	/** Opening a Page moves the Bookmark here; on the bookmarked Page the cursor resumes at its Sentence and Word. */
	#enter() {
		this.#key = pageKey(this.#page);
		this.#anchor = undefined;
		this.#part = undefined;
		const { bookmark } = this.#page.book;
		const here = bookmark.page === this.#page.position;
		const sentence = here ? bookmark.sentence : 1;
		const inSentence = this.words.filter((w) => w.sentence === sentence - 1);
		// Back on the Bookmark's Word if it has one, else at the start of a later Sentence.
		const first =
			(here ? bookmarkedWord(inSentence, bookmark.word, this.#page.language.code) : undefined) ?? (sentence > 1 ? inSentence[0] : undefined);
		this.cursor = first?.index;
		// Saved even when unchanged, so this Book becomes "where you are" for the Tutor.
		this.#bookmarked = '';
		this.#save(sentence, first?.text);
		if (first) this.#options.onMoved?.(first.index, 'resume');
	}

	/** Moving the Selection into another Sentence, or onto another Word, moves the Bookmark with it. */
	#follow() {
		const selected = this.selected;
		if (selected) this.#save(selected.sentence + 1, selected.text);
	}

	#save(sentence: number, word?: string) {
		const key = `${this.#page.position}|${sentence}|${word ?? ''}`;
		if (key === this.#bookmarked) return;
		this.#bookmarked = key;
		this.#options.saveBookmark?.(this.#page.book.id, { page: this.#page.position, sentence, ...(word ? { word } : {}) });
	}

	/**
	 * The text from Word `first` to Word `last`, if they are in one Sentence with only whitespace
	 * between them, as a Multi-word Term needs.
	 */
	#phraseText(first: number, last: number): string | undefined {
		if (this.words[first].sentence !== this.words[last].sentence) return undefined;
		const tokens = this.sentences[this.words[first].sentence].tokens;
		const between = tokens.slice(
			tokens.findIndex((t) => t.index === first),
			tokens.findIndex((t) => t.index === last) + 1
		);
		if (between.some((t) => t.key === undefined && t.text.trim() !== '')) return undefined;
		return between.map((t) => t.text).join('');
	}
}
