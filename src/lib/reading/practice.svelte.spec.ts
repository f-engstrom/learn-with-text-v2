import { describe, it, expect, vi } from 'vitest';
import type { TermView } from '#lib/server/domain/terms.ts';
import { Practice, practiceQueue, type DueWord, type PracticeSource } from './practice.svelte.ts';

describe('practiceQueue', () => {
	const word = (index: number, key: string, paragraph: number, sentence: number, overdue: 0 | 1 | 2 | 3, dueDay: number) => ({
		index, key, paragraph, sentence, practice: { due: new Date(2026, 9, dueDay).toISOString(), overdue, reviews: 1 }
	});
	const words = [
		word(0, 'кот', 1, 1, 1, 26),
		word(1, 'мышь', 1, 1, 0, 30),
		word(2, 'дом', 1, 2, 3, 20),
		word(3, 'кот', 2, 3, 1, 26),
		word(4, 'лес', 2, 3, 2, 24)
	];

	it('takes each Due Term once, leaving out Words not yet Due', () => {
		expect(practiceQueue(words, 'paragraph', { paragraph: 1 })).toEqual([0, 2]);
		expect(practiceQueue(words, 'paragraph', { paragraph: 2 })).toEqual([3, 4]);
	});

	it('takes the Highlight in text order', () => {
		expect(practiceQueue(words, 'highlight', { highlight: { first: 2, last: 3 } })).toEqual([2, 3, 4]);
		expect(practiceQueue(words, 'highlight')).toEqual([]);
	});

	it('orders by priority (most overdue first, for now) and by Due date', () => {
		expect(practiceQueue(words, 'priority')).toEqual([2, 4, 0]);
		expect(practiceQueue(words, 'overdue')).toEqual([2, 4, 0]);
	});

	it('puts frequent Words first in priority, then the more overdue', () => {
		const banded: DueWord[] = [
			{ ...words[2], frequency: 'rare' as const },
			{ ...words[4], frequency: 'top1k' as const },
			{ ...words[0], frequency: 'top1k' as const }
		];
		expect(practiceQueue(banded, 'priority')).toEqual([4, 0, 2]);
		// Within a band, the harder to carry over comes first.
		banded[2] = { ...banded[2], transfer: { form: 'easy', concept: 'hard' } };
		expect(practiceQueue(banded, 'priority')).toEqual([0, 4, 2]);
		expect(practiceQueue(banded, 'overdue')).toEqual([2, 4, 0]);
	});
});

describe('Practice on the Page', () => {
	const term = (id: number, overdue: 0 | 1 | 2 | 3, dueDay: number) =>
		({ id, status: 'learning2', practice: { due: new Date(2026, 9, dueDay).toISOString(), overdue, reviews: 1 } }) as TermView;

	function open(options: { refuse?: string; highlight?: boolean } = {}) {
		const source: PracticeSource = $state({
			words: [
				{ index: 0, key: 'кот', sentence: 0 },
				{ index: 1, key: 'мышь', sentence: 0 },
				{ index: 2, key: 'дом', sentence: 1 },
				{ index: 3, key: 'кот', sentence: 2 },
				{ index: 4, key: 'лес', sentence: 2 }
			],
			terms: { кот: term(1, 1, 26), мышь: term(2, 0, 30), дом: term(3, 3, 20), лес: term(4, 2, 24) },
			frequency: {},
			paragraphOf: [1, 1, 2],
			paragraph: 1,
			highlight: options.highlight ? { first: 2, last: 3 } : undefined,
			rightToLeft: false
		});
		let release: () => void = () => {};
		const review = vi.fn(
			() => new Promise<string | undefined>((resolve) => (release = () => resolve(options.refuse)))
		);
		const callbacks = { onReviewed: vi.fn(), onShow: vi.fn(), onStop: vi.fn(), onRefused: vi.fn() };
		const practice = new Practice(() => source, { review, ...callbacks });
		/** Grades and lets the Review through. */
		const grade = async (g: 'missed' | 'hard' | 'got') => {
			const graded = practice.grade(g);
			release();
			return graded;
		};
		return { source, practice, review, grade, ...callbacks };
	}
	const key = (code: string, key = code) => ({ code, key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false });

	it('counts each subset there is, following the cursor’s paragraph', () => {
		const { source, practice } = open();
		expect(practice.subsets).toEqual([
			{ subset: 'priority', count: 3 },
			{ subset: 'paragraph', count: 2 },
			{ subset: 'overdue', count: 3 }
		]);
		expect(practice.dueCount).toBe(3);
		source.paragraph = 2;
		expect(practice.subsets[1]).toEqual({ subset: 'paragraph', count: 2 });
		source.highlight = { first: 2, last: 2 };
		expect(practice.subsets.map((s) => s.subset)).toContain('highlight');
	});

	it('marks only the Terms in Top by priority, every place they appear', () => {
		const { source, practice } = open();
		expect([...practice.marked].sort()).toEqual(['дом', 'кот', 'лес']);
		// Ten more frequent Due Terms push the page's own out of the top.
		for (let i = 0; i < 10; i++) {
			source.words.push({ index: 5 + i, key: `слово${i}`, sentence: 2 });
			source.terms[`слово${i}`] = term(10 + i, 1, 26);
			source.frequency[`слово${i}`] = 'top1k';
		}
		expect(practice.marked.size).toBe(10);
		expect(practice.marked.has('дом')).toBe(false);
		expect(practice.dueCount).toBe(13);
	});

	it('goes through the subset, a Review per Word, then says how many', async () => {
		const { practice, review, grade, onReviewed, onShow } = open();
		practice.start();
		practice.pick('overdue');
		expect(onShow).toHaveBeenLastCalledWith(2);
		expect(practice.recalling).toBe(true);
		practice.reveal();
		expect(practice.recalling).toBe(false);
		expect(await grade('got')).toBeUndefined();
		expect(review).toHaveBeenLastCalledWith(3, 'got');
		expect(onReviewed).toHaveBeenCalledTimes(1);
		expect(practice.word).toBe(4);
		expect(practice.recalling).toBe(true);
		await grade('hard');
		await grade('missed');
		expect(review.mock.calls.map((c) => (c as unknown[])[0])).toEqual([3, 4, 1]);
		expect(practice.state).toEqual({ stage: 'done', reviewed: 3 });
	});

	it('stays on the Word when a Review is refused', async () => {
		const { practice, grade, onReviewed, onRefused } = open({ refuse: 'Only Learning 1–4 Terms are practised.' });
		practice.pick('overdue');
		expect(await grade('got')).toBe('Only Learning 1–4 Terms are practised.');
		expect(onRefused).toHaveBeenCalledWith('Only Learning 1–4 Terms are practised.');
		expect(onReviewed).not.toHaveBeenCalled();
		expect(practice.word).toBe(2);
	});

	it('grades a Word once, however quickly the keys come', async () => {
		const { practice, review } = open();
		practice.pick('overdue');
		practice.key(key('Digit3', '3'));
		practice.key(key('Digit3', '3'));
		expect(review).toHaveBeenCalledTimes(1);
	});

	it('takes its own keys and keeps the reading keys off while practising', () => {
		const { practice, review, onStop } = open({ highlight: true });
		expect(practice.key(key('Digit1', '1'))).toBe(false);
		practice.start();
		expect(practice.key(key('Digit2', '2'))).toBe(true);
		expect(practice.state).toMatchObject({ stage: 'run', subset: 'paragraph' });
		expect(practice.key(key('Space', ' '))).toBe(true);
		expect(practice.recalling).toBe(false);
		// Learning 4 by Status key would be a slip here: swallowed, not graded.
		expect(practice.key(key('Digit4', '4'))).toBe(true);
		expect(practice.key(key('KeyK', 'k'))).toBe(true);
		expect(review).not.toHaveBeenCalled();
		expect(practice.key(key('Escape'))).toBe(true);
		expect(practice.state).toBeUndefined();
		expect(onStop).toHaveBeenCalled();
	});
});
