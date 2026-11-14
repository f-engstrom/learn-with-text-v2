import { tick } from 'svelte';
import type { Bookmark } from '#lib/server/domain/books.ts';
import type { ReadingScreenData } from '#lib/server/reading-screen.ts';
import type { Grade } from '#lib/server/domain/practice.ts';
import type { Answer } from '#lib/server/domain/from-tutor.ts';
import type { Status } from '#lib/server/domain/terms.ts';
import { sendStatus } from '#lib/term-writes.ts';
import { sendReview } from '#lib/reviews.ts';
import { commandFor, routeKey, type Command, type KeyFacts, type KeyInput } from './keys.ts';
import { FromTutor, type Transport } from './from-tutor.svelte.ts';
import { highlightOnPage, turnPlace } from './highlight.ts';
import { OpenDictionary, panelTabs } from './open-dictionary.svelte.ts';
import { PersistedFlag, type FlagStorage } from './persisted-flag.svelte.ts';
import { Practice } from './practice.svelte.ts';
import { Selection, type Selected } from './selection.svelte.ts';
import { Zen } from './zen.svelte.ts';

/** What the reading screen shows: what its load returns. */
export type ScreenData = ReadingScreenData;

/** What the screen does to the page's elements; the page gives it, a spec fakes it. */
export interface View {
	/** Focuses Word `index` (the keys moved onto it). */
	focusWord(index: number): void;
	/** Scrolls Word `index` into view: `center` to resume at the Bookmark, `nearest` to keep it clear of a panel. */
	scrollToWord(index: number, block: 'center' | 'nearest'): void;
	/** Scrolls the Tutor's new Highlight into view. */
	scrollToHighlight(): void;
	/** Focuses the Tutor's turn. */
	focusTutor(): void;
	/** Pastes `text`, or else the clipboard's, as a Translation in the Term panel. */
	paste(text?: string): Promise<void>;
	/** Whether focus is in the Term panel's Dictionary panel. */
	inDictionary(): boolean;
	/** Moves focus to the Dictionary panel once it shows the open Dictionary. */
	reachDictionary(): Promise<void>;
}

/** How the screen reaches the server; by default over HTTP, with `reload` the page's `invalidateAll`. */
export interface Server {
	/** Reloads the Page's data; its result comes back through `sync`. */
	reload(): Promise<unknown>;
	/** Each resolves to why it was refused, if it was. */
	sendStatus?(languageId: number, text: string, status: Status): Promise<string | undefined>;
	sendReview?(termId: number, grade: Grade): Promise<string | undefined>;
	saveBookmark?(bookId: number, bookmark: Bookmark): void;
	tutor?: Transport;
}

export interface Options {
	view: View;
	server: Server;
	/** Where zen mode, Due marks and the open Dictionary are kept; localStorage in the browser. */
	storage?: () => FlagStorage;
	/** How often From the Tutor is polled. */
	tutorIntervalMs?: number;
}

/** Where a key landed, as the page reads it off the event. */
export type KeyPlace = Pick<KeyFacts, 'handled' | 'inTutorCard' | 'typing' | 'onControl'>;

/**
 * The reading screen: the Selection, Practice, zen mode, the open Dictionary and From the Tutor working
 * together, with the Term panel opened and closed, the error shown, and the keys carried out. The page
 * is its markup: it binds to these fields and passes events in.
 *
 * Constructed during server-side rendering too, so it reaches nothing until `sync` and `start`.
 */
export class ReadingScreen {
	#data = $state.raw() as ScreenData;
	/** Whether the Term panel is open (beside the text, or a sheet on a phone) for the Selection. */
	open = $state(false);
	/** Why the last thing you did was refused, shown over the text. */
	error = $state<string | undefined>();
	/** Statuses set by keyboard that the server hasn't confirmed yet, so the colour changes at once. */
	#pending = $state<Record<string, Status>>({});

	readonly selection: Selection;
	readonly practice: Practice;
	readonly zen: Zen;
	readonly dictionary: OpenDictionary;
	readonly fromTutor: FromTutor;
	/** Due marks on the Words of the Top by priority Terms, on unless you turn them off (D). */
	readonly dueMarks: PersistedFlag;

	/** The 1-based paragraph each Sentence (by 0-based index) is in. */
	paragraphOf = $derived(this.#data.paragraphs.flatMap((p, i) => p.sentences.map(() => i + 1)));
	/** The Tutor's Highlight, if it is on this Page. */
	highlightHere = $derived.by(() => {
		const highlight = this.fromTutor.highlight;
		return highlight?.page === this.#data.position ? highlight : undefined;
	});
	/** Where the Highlight falls on this Page: its Sentences, or its passage's tokens. */
	onPage = $derived.by(() => highlightOnPage(this.selection.sentences, this.highlightHere, this.#data.position));
	/** The Tutor's turn follows the Sentence its Highlight ends with; with no Highlight here it opens the Page. */
	turnAt = $derived(turnPlace(this.#data.paragraphs, this.onPage));
	/** The selected Term, if there is one, and its Frequency. */
	term = $derived.by(() => this.selection.selected && this.#data.terms[this.selection.selected.key]);
	band = $derived.by(() => this.selection.selected && this.#data.frequency[this.selection.selected.key]);
	/** Due Terms on this Page, each counted once; none while the Due marks are off. */
	dueOnPage = $derived.by(() => (this.dueMarks.value ? this.practice.dueCount : 0));
	/** In zen mode, the tapped Word's Translations, for its tooltip. */
	gloss = $derived.by(() => {
		if (!this.zen.on || !this.zen.glossShown || this.practice.recalling || !this.selection.selected) return '';
		return this.term?.translations.map((t) => t.text).join('; ') || 'No Translation yet';
	});

	#view: View;
	#reload: () => Promise<unknown>;
	#sendStatus: NonNullable<Server['sendStatus']>;
	#sendReview: NonNullable<Server['sendReview']>;

	/** Shows `data` with nothing selected; the first `sync`, in the browser, resumes at the Bookmark. */
	constructor(data: ScreenData, { view, server, storage, tutorIntervalMs }: Options) {
		this.#data = data;
		this.#view = view;
		this.#reload = server.reload;
		this.#sendStatus = server.sendStatus ?? sendStatus;
		this.#sendReview = server.sendReview ?? ((termId, grade) => sendReview(termId, grade, 'page'));
		this.selection = new Selection(data, {
			...(server.saveBookmark && { saveBookmark: server.saveBookmark }),
			onMoved: async (index, how) => {
				await tick();
				if (how === 'resume') this.#view.scrollToWord(index, 'center');
				else this.#view.focusWord(index);
			}
		});
		this.practice = new Practice(
			() => {
				const cursor = this.selection.cursor;
				return {
					words: this.selection.words,
					terms: this.#data.terms,
					frequency: this.#data.frequency,
					paragraphOf: this.paragraphOf,
					// "This paragraph" is the cursor's, else the first.
					paragraph: cursor === undefined ? 1 : this.paragraphOf[this.selection.words[cursor].sentence],
					highlight: this.highlightHere,
					rightToLeft: this.#data.language.rightToLeft
				};
			},
			{
				review: (termId, grade) => this.#sendReview(termId, grade),
				onReviewed: () => {
					this.error = undefined;
					return this.#reload();
				},
				onRefused: (message) => (this.error = message),
				// The cursor goes onto the practised Word, scrolled clear of the practice panel.
				onShow: async (index) => {
					this.selection.moveTo(index);
					await tick();
					this.#view.scrollToWord(index, 'nearest');
				},
				onStop: () => this.selection.refocus()
			}
		);
		// Zen mode on or off closes the Term panel.
		this.zen = new Zen({ storage, onChange: () => (this.open = false) });
		this.dictionary = new OpenDictionary(storage);
		this.dueMarks = new PersistedFlag('reader.due', true, storage);
		this.fromTutor = new FromTutor(this.#tutorState(data), {
			// Left out unless given, so FromTutor's own defaults (HTTP, every two seconds) apply.
			...(server.tutor && { transport: server.tutor }),
			...(tutorIntervalMs !== undefined && { intervalMs: tutorIntervalMs }),
			// The Tutor saved a Gloss or changed a Term: the Page's Statuses and Translations follow.
			onTermsChanged: () => this.#reload(),
			// A new Highlight on this Page comes into view; the cursor and Bookmark stay put.
			onNewHighlight: async (h) => {
				if (h.page !== this.#data.position) return;
				await tick();
				this.#view.scrollToHighlight();
			}
		});
	}

	/** Takes what the load returned. A new Page closes the Term panel and clears the error. */
	sync(data: ScreenData) {
		const language = this.#data.language.id;
		this.#data = data;
		if (this.selection.sync(data)) {
			this.open = false;
			this.error = undefined;
		}
		this.fromTutor.sync(this.#tutorState(data));
		if (data.language.id !== language) this.dictionary.load(data.language.id);
	}

	/** In the browser, once mounted: reads what this browser keeps and polls From the Tutor. Returns a function that stops. */
	start(): () => void {
		this.zen.load();
		this.dueMarks.load();
		this.dictionary.load(this.#data.language.id);
		const stop = this.fromTutor.start();
		return () => {
			stop();
			this.zen.destroy();
		};
	}

	/** The Status a Word shows: one you just set, else its Term's, else Unknown. */
	statusOf = (key: string): Status | 'unknown' => this.#pending[key] ?? this.#data.terms[key]?.status ?? 'unknown';

	/** How overdue a Word's Due mark is: only on the Top by priority Terms, and none while the marks are off. */
	overdueOf = (key: string): 0 | 1 | 2 | 3 =>
		this.dueMarks.value && this.practice.marked.has(key) ? (this.#data.terms[key]?.practice?.overdue ?? 0) : 0;

	/** A key press; returns whether the screen used it, so the page prevents its default. */
	key(e: KeyInput, place: KeyPlace): boolean {
		const route = routeKey({
			...place,
			zen: this.zen.on,
			command: commandFor(e, this.#data.language.rightToLeft),
			practice: () => this.practice.key(e)
		});
		if (route.to === 'none') return false;
		if (route.to === 'zen') {
			if (route.key === 'enter') this.zen.enter();
			else this.zen.escape();
		}
		if (route.to === 'reading') this.run(route.command);
		return true;
	}

	/** Carries out a reading command. */
	run(command: Command) {
		const selected = this.selection.selected;
		switch (command.kind) {
			case 'move':
			case 'sentence':
				this.selection.move(command);
				break;
			case 'extend':
				this.error = this.selection.move(command);
				break;
			case 'status':
				if (selected) this.setStatus(selected, command.status);
				break;
			case 'open':
				if (selected) this.open = true;
				break;
			case 'paste':
				if (selected) this.paste();
				break;
			case 'zen':
				this.zen.toggle();
				break;
			case 'due':
				this.dueMarks.toggle();
				break;
			case 'practice':
				this.zen.leave();
				this.startPractice();
				break;
			case 'tutor':
				this.#view.focusTutor();
				break;
			case 'dictionary':
				if (selected && !this.zen.on && !this.practice.state) this.#goToDictionary(command.by);
				break;
			case 'close':
				this.close();
				break;
		}
	}

	/** A click or tap on Word `index`; with Shift it grows a phrase to it. */
	choose(index: number, shift: boolean) {
		const { again, error } = this.selection.choose(index, shift);
		if (shift) this.error = error;
		// In zen mode a tap shows the Word's Translations; tapping it again hides them.
		if (this.zen.on) {
			this.zen.tapWord(again);
			return;
		}
		this.open = true;
		// On a phone the Term panel is a sheet over the bottom of the screen; keep the Word above it.
		tick().then(() => this.#view.scrollToWord(index, 'nearest'));
	}

	/** Closes the Term panel and puts focus back on the text. */
	close() {
		this.open = false;
		this.selection.refocus();
	}

	/** Sets the Status of `word`, showing it at once, before the server confirms. */
	async setStatus(word: Selected, status: Status) {
		this.#pending[word.key] = status;
		this.error = await this.#sendStatus(this.#data.language.id, word.text, status);
		await this.#reload();
		delete this.#pending[word.key];
	}

	/** A Review from the Practice card in the Term panel. */
	async review(termId: number, grade: Grade) {
		this.error = await this.#sendReview(termId, grade);
		await this.#reload();
	}

	/** Opens the Term panel and pastes `text`, or else the clipboard's, as a Translation of the Selection. */
	async paste(text?: string) {
		if (!this.selection.selected) return;
		this.open = true;
		await tick();
		await this.#view.paste(text);
	}

	startPractice() {
		this.open = false;
		this.practice.start();
	}

	async answerTutor(answer: Answer) {
		const refused = await this.fromTutor.answer(answer);
		if (refused) this.error = refused;
	}

	/** Leaving the Tutor's turn by key: back to the cursor, or the first Word if there is none. */
	leaveTutor() {
		if (this.selection.cursor === undefined) this.selection.moveTo(0);
		else this.selection.refocus();
	}

	/** L: opens the Term panel and goes to its Dictionary panel, opening the next Dictionary once there. */
	async #goToDictionary(by: 1 | -1) {
		this.open = true;
		await tick();
		this.dictionary.reach(panelTabs(this.#data.dictionaries, this.#data.azureReady), by, this.#view.inDictionary());
		await this.#view.reachDictionary();
	}

	#tutorState(data: ScreenData) {
		return { bookId: data.book.id, highlight: data.highlight, question: data.question, termsVersion: data.termsVersion };
	}
}
