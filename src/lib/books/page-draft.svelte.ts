/**
 * The Pages of a Book on the edit screen, before Save. Each Page keeps its id, so its Read mark and
 * the Bookmark go with it wherever it moves (ADR 0008); Save sends `toJSON()` to `editBook`.
 */
import type { EditablePage } from '#lib/server/domain/book-editing.ts';
import { joinTexts, splitAtBreaks } from '../pages';

export interface DraftPage {
	/** Stable across moves, for the list's keys. */
	key: string;
	/** null for a Page added here. */
	id: number | null;
	/** Its position before this edit; null for a Page added here. */
	was: number | null;
	text: string;
	readAt: string | null;
	/** Removed on Save; Undo brings it back until then. */
	removed: boolean;
	open: boolean;
}

const segmenters = new Map<string, Intl.Segmenter>();

/** Words in a text by the Language's segmentation (ADR 0002), close enough for the screen. */
export function countWords(text: string, languageCode: string): number {
	let segmenter = segmenters.get(languageCode);
	if (!segmenter) segmenters.set(languageCode, (segmenter = new Intl.Segmenter(languageCode, { granularity: 'word' })));
	let words = 0;
	for (const s of segmenter.segment(text)) if (s.isWordLike) words++;
	return words;
}

let added = 0;
const newKey = () => `new-${++added}`;

export class PageDraft {
	pages = $state<DraftPage[]>([]);
	readonly #initial: string;

	constructor(pages: EditablePage[]) {
		this.pages = pages.map((p, i) => ({ key: `page-${p.id}`, id: p.id, was: i + 1, text: p.text, readAt: p.readAt, removed: false, open: false }));
		this.#initial = this.#snapshot();
	}

	/** The Pages that will be, in order. */
	kept = $derived(this.pages.filter((p) => !p.removed));

	/** Whether anything differs from the Book as it is. */
	get changed(): boolean {
		return this.#snapshot() !== this.#initial;
	}

	/** Its number once saved, counting only kept Pages; null when removed. */
	numberOf(page: DraftPage): number | null {
		const i = this.kept.indexOf(page);
		return i === -1 ? null : i + 1;
	}

	/** Swaps a Page with the kept Page above (-1) or below (1) it. */
	move(page: DraftPage, by: -1 | 1): void {
		const i = this.pages.indexOf(page);
		let j = i + by;
		while (this.pages[j]?.removed) j += by;
		if (j < 0 || j >= this.pages.length) return;
		[this.pages[i], this.pages[j]] = [this.pages[j], this.pages[i]];
	}

	remove(page: DraftPage): void {
		page.removed = true;
		page.open = false;
	}

	restore(page: DraftPage): void {
		page.removed = false;
	}

	unmarkRead(page: DraftPage): void {
		page.readAt = null;
	}


	/** The next kept Page's text joins this one; it stays Read only if both were. */
	joinWithNext(page: DraftPage): void {
		const next = this.kept[this.kept.indexOf(page) + 1];
		if (!next) return;
		page.text = joinTexts(page.text, next.text);
		if (!next.readAt) page.readAt = null;
		this.pages.splice(this.pages.indexOf(next), 1);
	}

	/**
	 * Adds the text as new Pages, a `---` line between them, after the given Page or first when
	 * it is null. How many it added.
	 */
	addPages(text: string, after: DraftPage | null): number {
		const parts = splitAtBreaks(text);
		const at = after ? this.pages.indexOf(after) + 1 : 0;
		this.pages.splice(at, 0, ...parts.map((part) => ({ key: newKey(), id: null, was: null, text: part, readAt: null, removed: false, open: false })));
		return parts.length;
	}

	/** What Save sends: the kept Pages in order, each with its id, text and whether it is still Read. */
	toJSON(): { id: number | null; text: string; read: boolean }[] {
		return this.kept.map((p) => ({ id: p.id, text: p.text, read: p.readAt !== null }));
	}

	#snapshot(): string {
		return JSON.stringify(this.pages.map((p) => [p.id, p.text, p.readAt, p.removed]));
	}
}
