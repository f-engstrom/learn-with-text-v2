import { PersistedFlag, type FlagStorage } from './persisted-flag.svelte.ts';

export interface Options {
	storage?: () => FlagStorage;
	/** How long the controls stay after you last moved. */
	idleMs?: number;
	/** Zen mode came on or went off: the page closes the Term form. */
	onChange?: (on: boolean) => void;
}

/**
 * Zen mode: only the text. Tapping a Word shows its Translations in a tooltip; the controls show while
 * you move, and hide after a couple of idle seconds. Kept on or off in this browser.
 */
export class Zen {
	/** Whether the controls are hidden, after a while without moving. */
	idle = $state(false);
	/** Whether the selected Word's Translation tooltip is showing. */
	glossShown = $state(false);
	#flag: PersistedFlag;
	#idleMs: number;
	#onChange?: (on: boolean) => void;
	#timer: ReturnType<typeof setTimeout> | undefined;

	constructor({ storage, idleMs = 2500, onChange }: Options = {}) {
		this.#flag = new PersistedFlag('reader.zen', false, storage);
		this.#idleMs = idleMs;
		this.#onChange = onChange;
	}

	get on(): boolean {
		return this.#flag.value;
	}

	/** Reads whether zen mode was on; the page calls it once mounted. */
	load() {
		this.#flag.load();
		this.wake();
	}

	toggle() {
		this.#flag.toggle();
		this.glossShown = false;
		this.wake();
		this.#onChange?.(this.on);
	}

	/** Leaves zen mode, e.g. to practise. */
	leave() {
		if (this.on) this.toggle();
	}

	/** Shows the controls, and hides them again after a couple of idle seconds. */
	wake() {
		this.idle = false;
		clearTimeout(this.#timer);
		if (this.on) this.#timer = setTimeout(() => (this.idle = true), this.#idleMs);
	}

	/** A tap on a Word shows its Translations; tapping the selected Word `again` hides them. */
	tapWord(again: boolean) {
		this.glossShown = !(again && this.glossShown);
	}

	/** A tap outside the text hides the tooltip and shows the controls. */
	tapOutside() {
		if (!this.on) return;
		this.glossShown = false;
		this.wake();
	}

	/** Enter shows or hides the tooltip. */
	enter() {
		this.glossShown = !this.glossShown;
	}

	/** Escape hides the tooltip, or else leaves zen mode. */
	escape() {
		if (this.glossShown) this.glossShown = false;
		else this.toggle();
	}

	destroy() {
		clearTimeout(this.#timer);
	}
}
