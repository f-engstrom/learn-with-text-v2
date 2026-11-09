import type { Answer, FromTutor as State, TutorQuestion } from '#lib/server/domain/from-tutor.ts';
import type { Highlight } from '#lib/server/domain/reading.ts';

/** How the reading screen reaches /books/[id]/tutor. */
export interface Transport {
	/** From the Tutor for the Book, or undefined if it couldn't be fetched. */
	get(bookId: number): Promise<State | undefined>;
	/** Sends an answer; resolves to an error message if it was refused. */
	answer(bookId: number, askedAt: string, answer: Answer): Promise<string | undefined>;
	dismiss(bookId: number): Promise<void>;
}

export const httpTransport: Transport = {
	get: (bookId) =>
		fetch(`/books/${bookId}/tutor`)
			.then((r) => (r.ok ? r.json() : undefined))
			.catch(() => undefined),
	async answer(bookId, askedAt, answer) {
		const response = await fetch(`/books/${bookId}/tutor`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ askedAt, answer })
		}).catch(() => undefined);
		if (response?.ok) return undefined;
		const body = await response?.json().catch(() => undefined);
		return String(body?.message ?? 'Could not send your answer.');
	},
	async dismiss(bookId) {
		await fetch(`/books/${bookId}/tutor`, { method: 'DELETE' }).catch(() => undefined);
	}
};

export interface Options {
	/** The Terms version moved on: the Tutor (or anyone) changed a Term, so the Page's Terms should reload. */
	onTermsChanged?: () => void;
	/** The Tutor set a new Highlight while the screen was open. */
	onNewHighlight?: (highlight: Highlight) => void;
	transport?: Transport;
	intervalMs?: number;
	isHidden?: () => boolean;
}

/**
 * From the Tutor in the reading screen: the Highlight and Tutor's question, kept current by polling,
 * with answering and dismissing. A poll that started before a local change (sync, answer, dismiss) is
 * ignored, so what you just did doesn't flash back.
 */
export class FromTutor {
	highlight = $state<Highlight | null>(null);
	question = $state<TutorQuestion | null>(null);
	/** Put off with Later: the turn is a pill until you open it, or the Tutor asks or highlights something new. */
	folded = $state(false);
	#bookId: number;
	/** What `folded` was set for: the question, else the Highlight. */
	#foldedFor = '';
	#termsVersion: number;
	/** Moves on with every local change; a poll answered for an older one is dropped. */
	#generation = 0;
	#options: Required<Omit<Options, 'onTermsChanged' | 'onNewHighlight'>> & Options;

	constructor(initial: State & { bookId: number }, options: Options = {}) {
		this.#bookId = initial.bookId;
		this.#termsVersion = initial.termsVersion;
		this.highlight = initial.highlight;
		this.question = initial.question;
		this.#foldedFor = this.#showing();
		this.#options = {
			transport: httpTransport,
			intervalMs: 2000,
			isHidden: () => typeof document !== 'undefined' && document.hidden,
			...options
		};
	}

	/** Takes what a load returned: a new Page or Book, or Terms reloaded after a change of your own. */
	sync(state: State & { bookId: number }) {
		this.#generation++;
		this.#bookId = state.bookId;
		this.#termsVersion = state.termsVersion;
		this.highlight = state.highlight;
		this.question = state.question;
		this.#refold();
	}

	fold() {
		this.folded = true;
	}

	unfold() {
		this.folded = false;
	}

	/** Answers the current question; resolves to an error message if the Tutor has moved on. */
	async answer(answer: Answer): Promise<string | undefined> {
		const question = this.question;
		if (!question) return undefined;
		this.#generation++;
		const error = await this.#options.transport.answer(this.#bookId, question.askedAt, answer);
		this.#generation++;
		if (error) return error;
		if (this.question?.askedAt === question.askedAt) this.question = { ...question, answer };
		return undefined;
	}

	/** Puts the Tutor aside: its question and Highlight leave the screen until it asks again. */
	async dismiss() {
		this.highlight = null;
		this.question = null;
		this.#generation++;
		await this.#options.transport.dismiss(this.#bookId);
		this.#generation++;
	}

	/** Polls while the tab is visible; returns a function that stops. */
	start(): () => void {
		const poll = setInterval(() => this.#poll(), this.#options.intervalMs);
		return () => clearInterval(poll);
	}

	async #poll() {
		if (this.#options.isHidden()) return;
		const generation = this.#generation;
		const latest = await this.#options.transport.get(this.#bookId);
		if (!latest || generation !== this.#generation) return;
		this.question = latest.question;
		if (latest.termsVersion !== this.#termsVersion) {
			this.#termsVersion = latest.termsVersion;
			this.#options.onTermsChanged?.();
		}
		if (latest.highlight?.at !== this.highlight?.at) {
			this.highlight = latest.highlight;
			if (latest.highlight) this.#options.onNewHighlight?.(latest.highlight);
		}
		this.#refold();
	}

	#showing() {
		return this.question?.askedAt ?? this.highlight?.at ?? '';
	}

	/** Something new from the Tutor opens the turn again. */
	#refold() {
		const showing = this.#showing();
		if (showing === this.#foldedFor) return;
		this.#foldedFor = showing;
		this.folded = false;
	}
}
