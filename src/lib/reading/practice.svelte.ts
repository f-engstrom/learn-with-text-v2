import type { FrequencyBand } from '#lib/server/domain/frequency.ts';
import type { Grade, PracticeView } from '#lib/server/domain/practice.ts';
import type { TermView, Transfer } from '#lib/server/domain/terms.ts';
import { byPriority } from '#lib/practice.ts';
import { sendReview } from '#lib/reviews.ts';
import { commandFor, type KeyInput } from './keys.ts';

/** The subsets of a Page's Due Words you can practise. */
export type Subset = 'priority' | 'paragraph' | 'highlight' | 'overdue';

export const subsetLabels: Record<Subset, string> = {
	priority: 'Top by priority',
	paragraph: 'This paragraph',
	highlight: 'The Highlight',
	overdue: 'Most overdue'
};

/** A Due Word on the Page: where it is, and its Term's place in practice. */
export interface DueWord {
	index: number;
	key: string;
	/** 1-based Sentence and paragraph on the Page. */
	sentence: number;
	paragraph: number;
	practice: PracticeView;
	frequency?: FrequencyBand;
	transfer?: Transfer;
}

/** How many Words "Top by priority" takes. */
export const TOP = 10;

/**
 * The Words to practise, in order: each Due Term once, at its first place in the subset.
 * Paragraph and Highlight keep the text's order; the others go by priority or overdueness.
 */
export function practiceQueue(
	words: DueWord[],
	subset: Subset,
	{ paragraph, highlight }: { paragraph?: number; highlight?: { first: number; last: number } } = {}
): number[] {
	const due = words.filter((w) => w.practice.overdue > 0);
	const seen = new Set<string>();
	const once = (list: DueWord[]) => list.filter((w) => !seen.has(w.key) && seen.add(w.key));
	switch (subset) {
		case 'paragraph':
			return once(due.filter((w) => w.paragraph === paragraph)).map((w) => w.index);
		case 'highlight':
			return highlight ? once(due.filter((w) => w.sentence >= highlight.first && w.sentence <= highlight.last)).map((w) => w.index) : [];
		case 'priority':
			return once([...due].sort(byPriority)).slice(0, TOP).map((w) => w.index);
		case 'overdue':
			return once([...due].sort((a, b) => Date.parse(a.practice.due) - Date.parse(b.practice.due) || a.index - b.index)).map((w) => w.index);
	}
}

/** Practice on the Page: choosing a subset, then one Due Word at a time, then a summary. */
export type PracticeState =
	| { stage: 'choose' }
	| { stage: 'run'; subset: Subset; queue: number[]; at: number; revealed: boolean; reviewed: number }
	| { stage: 'done'; reviewed: number };

/** What Practice reads of the Page, kept current by the page. */
export interface PracticeSource {
	/** The Page's Words; `sentence` is 0-based. */
	words: { index: number; key: string; sentence: number }[];
	terms: Record<string, TermView>;
	frequency: Record<string, FrequencyBand>;
	/** The 1-based paragraph of each Sentence, by 0-based Sentence. */
	paragraphOf: number[];
	/** "This paragraph": the cursor's, 1-based. */
	paragraph: number;
	/** The Highlight's Sentences on this Page, 1-based, if it is here. */
	highlight?: { first: number; last: number };
	rightToLeft: boolean;
}

export interface Options {
	/** Sends a Review; resolves to why it was refused. By default to POST /terms/[id]/reviews. */
	review?: (termId: number, grade: Grade) => Promise<string | undefined>;
	/** A Review was saved: the page reloads its Terms so the Due marks follow. */
	onReviewed?: () => Promise<unknown> | void;
	/** A Review was refused; the practised Word stays up. */
	onRefused?: (message: string) => void;
	/** Word `index` comes up: the page puts the cursor on it. */
	onShow?: (index: number) => void;
	/** Practice stopped: the page puts focus back on the text. */
	onStop?: () => void;
}

const subsetOrder: Subset[] = ['priority', 'paragraph', 'highlight', 'overdue'];

/**
 * Practice: going through the Page's Due Words in a subset you choose, recalling each in its Sentence
 * and grading it as a Review.
 */
export class Practice {
	state = $state<PracticeState | undefined>();
	dueWords: DueWord[] = $derived.by(() => {
		const { words, terms, frequency, paragraphOf } = this.#source();
		return words.flatMap((w) => {
			const practice = terms[w.key]?.practice;
			if (!practice) return [];
			return [
				{
					index: w.index,
					key: w.key,
					sentence: w.sentence + 1,
					paragraph: paragraphOf[w.sentence],
					practice,
					frequency: frequency[w.key],
					transfer: terms[w.key]?.transfer
				}
			];
		});
	});
	/** Each subset there is on this Page, with how many Due Words it holds, in key order. */
	subsets = $derived.by(() => {
		const { paragraph, highlight } = this.#source();
		return subsetOrder
			.filter((s) => s !== 'highlight' || highlight)
			.map((subset) => ({ subset, count: practiceQueue(this.dueWords, subset, { paragraph, highlight }).length }));
	});
	/** Due Terms on this Page, each counted once. */
	dueCount = $derived(practiceQueue(this.dueWords, 'overdue').length);
	/** The Terms that carry a Due mark: those in Top by priority, so a Page with many Due Terms isn't dotted all over. */
	marked: Set<string> = $derived.by(() => {
		const keyOf = new Map(this.dueWords.map((w) => [w.index, w.key]));
		return new Set(practiceQueue(this.dueWords, 'priority').map((index) => keyOf.get(index)!));
	});
	/** The Word being practised, by index. */
	word = $derived(this.state?.stage === 'run' ? this.state.queue[this.state.at] : undefined);
	/** While the practised Word's meaning is still hidden. */
	recalling = $derived(this.state?.stage === 'run' && !this.state.revealed);

	#source: () => PracticeSource;
	#options: Options;
	/** While a Review is saving, so a quick second key can't grade the same Word twice. */
	#grading = false;

	constructor(source: () => PracticeSource, options: Options = {}) {
		this.#source = source;
		this.#options = { review: (termId, grade) => sendReview(termId, grade, 'page'), ...options };
	}

	start() {
		this.state = { stage: 'choose' };
	}

	pick(subset: Subset) {
		const { paragraph, highlight } = this.#source();
		const queue = practiceQueue(this.dueWords, subset, { paragraph, highlight });
		if (queue.length === 0) return;
		this.state = { stage: 'run', subset, queue, at: 0, revealed: false, reviewed: 0 };
		this.#options.onShow?.(queue[0]);
	}

	reveal() {
		if (this.state?.stage === 'run') this.state.revealed = true;
	}

	/** Grades the practised Word and goes on to the next; resolves to why the Review was refused, staying put. */
	async grade(grade: Grade): Promise<string | undefined> {
		if (this.state?.stage !== 'run' || this.#grading) return undefined;
		const run = this.state;
		const word = this.#source().words.find((w) => w.index === run.queue[run.at]);
		const term = word && this.#source().terms[word.key];
		this.#grading = true;
		try {
			const refused = term ? await this.#options.review!(term.id, grade) : undefined;
			if (refused) {
				this.#options.onRefused?.(refused);
				return refused;
			}
			await this.#options.onReviewed?.();
		} finally {
			this.#grading = false;
		}
		const at = run.at + 1;
		if (at >= run.queue.length) {
			this.state = { stage: 'done', reviewed: run.reviewed + 1 };
			return undefined;
		}
		this.state = { ...run, at, revealed: false, reviewed: run.reviewed + 1 };
		this.#options.onShow?.(run.queue[at]);
		return undefined;
	}

	stop() {
		this.state = undefined;
		this.#options.onStop?.();
	}

	/** Practice keys: digits pick a subset or grade, Space or Enter reveals, Esc stops. Returns whether it took the key. */
	key(e: KeyInput): boolean {
		if (!this.state || e.ctrlKey || e.metaKey || e.altKey) return false;
		if (e.key === 'Escape') {
			this.stop();
			return true;
		}
		const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
		if (this.state.stage === 'choose' && digit) {
			const choice = this.subsets.filter((s) => s.count > 0)[Number(digit) - 1];
			if (choice) this.pick(choice.subset);
			return true;
		}
		if (this.state.stage === 'run') {
			if (e.code === 'Space' || e.code === 'Enter') {
				this.reveal();
				return true;
			}
			if (digit && Number(digit) <= 3) {
				this.grade((['missed', 'hard', 'got'] as const)[Number(digit) - 1]);
				return true;
			}
			// Reading keys stay off while practising, so a Status key can't be pressed by mistake.
			return commandFor(e, this.#source().rightToLeft) !== undefined;
		}
		return false;
	}
}
