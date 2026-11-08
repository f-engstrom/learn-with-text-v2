/** Where a flag is kept; localStorage in the browser. */
export type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * An on/off setting kept in this browser, such as Due marks or zen mode. It starts at its default and
 * reads the stored value on `load`, which the page calls once mounted, so server and browser render alike.
 * Storage that is missing or refuses (private browsing) leaves it at what it is.
 */
export class PersistedFlag {
	value = $state(false);
	#key: string;
	#storage: () => FlagStorage;

	constructor(key: string, fallback: boolean, storage: () => FlagStorage = () => localStorage) {
		this.#key = key;
		this.value = fallback;
		this.#storage = storage;
	}

	load() {
		try {
			const stored = this.#storage().getItem(this.#key);
			if (stored === 'on' || stored === 'off') this.value = stored === 'on';
		} catch {}
	}

	set(value: boolean) {
		this.value = value;
		try {
			this.#storage().setItem(this.#key, value ? 'on' : 'off');
		} catch {}
	}

	toggle() {
		this.set(!this.value);
	}
}
