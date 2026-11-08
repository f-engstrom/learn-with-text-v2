import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromTutor as State } from '#lib/server/domain/from-tutor.ts';
import { FromTutor, type Transport } from './from-tutor.svelte.ts';

const highlight = (at: string) => ({ page: 1, first: 1, last: 1, at });
const question = (askedAt: string) => ({ questions: [{ prompt: 'Translate «Кот спит».' }], askedAt });
const empty: State = { highlight: null, question: null, termsVersion: 1 };

/** A server whose state the test sets, and whose replies it can hold back. */
function server(initial: State = empty) {
	let state = initial;
	let held: (() => void)[] | undefined;
	const reply = <T>(value: () => T) =>
		new Promise<T>((resolve) => (held ? held.push(() => resolve(value())) : resolve(value())));
	const transport: Transport = {
		get: vi.fn(() => reply(() => state)),
		answer: vi.fn((_bookId: number, askedAt: string) =>
			reply(() => (state.question?.askedAt === askedAt ? undefined : 'The Tutor has moved on from that question.'))
		),
		dismiss: vi.fn(() => reply(() => undefined))
	};
	return {
		transport,
		set: (next: Partial<State>) => (state = { ...state, ...next }),
		hold: () => (held = []),
		/** Sends the held replies, newest first, so a poll from before comes back last. */
		release: async () => {
			const replies = held ?? [];
			held = undefined;
			for (const r of replies.reverse()) {
				r();
				await vi.advanceTimersByTimeAsync(0);
			}
		}
	};
}

function open(s: ReturnType<typeof server>, options: { hidden?: boolean; initial?: State } = {}) {
	const onTermsChanged = vi.fn();
	const onNewHighlight = vi.fn();
	const fromTutor = new FromTutor(
		{ bookId: 1, ...(options.initial ?? empty) },
		{ transport: s.transport, onTermsChanged, onNewHighlight, intervalMs: 100, isHidden: () => options.hidden ?? false }
	);
	const stop = fromTutor.start();
	return { fromTutor, onTermsChanged, onNewHighlight, stop };
}

const poll = () => vi.advanceTimersByTimeAsync(100);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('From the Tutor in the reading screen', () => {
	it('shows what the Tutor sets, on the next poll', async () => {
		const s = server();
		const { fromTutor, stop } = open(s);
		s.set({ highlight: highlight('a'), question: question('q1') });
		await poll();
		expect(fromTutor.highlight).toEqual(highlight('a'));
		expect(fromTutor.question).toEqual(question('q1'));
		stop();
	});

	it('says when the Tutor sets a new Highlight, not on every poll', async () => {
		const s = server();
		const { onNewHighlight, stop } = open(s);
		s.set({ highlight: highlight('a') });
		await poll();
		await poll();
		s.set({ highlight: highlight('b') });
		await poll();
		expect(onNewHighlight.mock.calls).toEqual([[highlight('a')], [highlight('b')]]);
		stop();
	});

	it('says once when the Terms version moves on, and not after a sync to it', async () => {
		const s = server();
		const { fromTutor, onTermsChanged, stop } = open(s);
		s.set({ termsVersion: 2 });
		await poll();
		await poll();
		expect(onTermsChanged).toHaveBeenCalledTimes(1);
		// A Status you set reloads the Page, which brings its own version.
		s.set({ termsVersion: 3 });
		fromTutor.sync({ bookId: 1, ...empty, termsVersion: 3 });
		await poll();
		expect(onTermsChanged).toHaveBeenCalledTimes(1);
		stop();
	});

	it('keeps a dismissal even when a poll from before it comes back late', async () => {
		const s = server({ ...empty, highlight: highlight('a'), question: question('q1') });
		const { fromTutor, stop } = open(s, { initial: { ...empty, highlight: highlight('a'), question: question('q1') } });
		s.hold();
		await poll();
		const dismissed = fromTutor.dismiss();
		await s.release();
		await dismissed;
		await vi.advanceTimersByTimeAsync(0);
		expect(fromTutor.highlight).toBeNull();
		expect(fromTutor.question).toBeNull();
		stop();
	});

	it('keeps an answer even when a poll from before it comes back late', async () => {
		const s = server({ ...empty, question: question('q1') });
		const { fromTutor, stop } = open(s, { initial: { ...empty, question: question('q1') } });
		s.hold();
		await poll();
		const answered = fromTutor.answer({ answers: ['The cat sleeps'] });
		await s.release();
		expect(await answered).toBeUndefined();
		await vi.advanceTimersByTimeAsync(0);
		expect(fromTutor.question?.answer).toEqual({ answers: ['The cat sleeps'] });
		stop();
	});

	it('passes on the refusal of an answer to a replaced question', async () => {
		const s = server({ ...empty, question: question('q2') });
		const { fromTutor, stop } = open(s, { initial: { ...empty, question: question('q1') } });
		expect(await fromTutor.answer({ answers: ['The cat sleeps'] })).toBe('The Tutor has moved on from that question.');
		expect(fromTutor.question?.answer).toBeUndefined();
		stop();
	});

	it('does not poll while the tab is hidden', async () => {
		const s = server();
		const { stop } = open(s, { hidden: true });
		await poll();
		expect(s.transport.get).not.toHaveBeenCalled();
		stop();
	});
});
