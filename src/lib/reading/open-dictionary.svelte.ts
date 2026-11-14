import type { Dictionary } from '#lib/dictionaries.ts';
import type { FlagStorage } from './persisted-flag.svelte.ts';

/** A tab of the Dictionary panel: a built-in Dictionary, or a configured one by its id. */
export type DictionaryTab = 'wiktionary' | 'azure' | number;

/**
 * The tabs that open in the panel, in order: Wiktionary, Azure when it is set up, and the configured
 * Dictionaries shown in it (the Wiktionary page aside, which the Wiktionary tab shows). A popup
 * Dictionary opens a window instead, so it is no tab to step to.
 */
export function panelTabs(dictionaries: Pick<Dictionary, 'id' | 'display'>[], azureReady: boolean): DictionaryTab[] {
	return [
		'wiktionary',
		...(azureReady ? (['azure'] as const) : []),
		...dictionaries.filter((d) => d.display === 'embedded').map((d) => d.id)
	];
}

/** How a tab is kept in storage; `none` is the panel closed. */
const write = (tab: DictionaryTab | null) => (tab === null ? 'none' : typeof tab === 'number' ? `d:${tab}` : tab);

function read(stored: string | null): DictionaryTab | null | undefined {
	if (stored === 'none') return null;
	if (stored === 'wiktionary' || stored === 'azure') return stored;
	const id = /^d:(\d+)$/.exec(stored ?? '')?.[1];
	return id === undefined ? undefined : Number(id);
}

/**
 * Which Dictionary is open in the Dictionary panel, if any: kept while you move between Words, and in
 * this browser for each Language, since a configured Dictionary belongs to one. With none open, nothing
 * is looked up. Wiktionary until you choose; it reads what was kept on `load`, which the page calls in
 * the browser, so server and browser render alike.
 */
export class OpenDictionary {
	tab = $state<DictionaryTab | null>('wiktionary');
	#language: number | undefined;
	#storage: () => FlagStorage;

	constructor(storage: () => FlagStorage = () => localStorage) {
		this.#storage = storage;
	}

	/** Reads what was kept for `language`; the page calls it once mounted and when the Language changes. */
	load(language: number) {
		this.#language = language;
		let kept: DictionaryTab | null | undefined;
		try {
			kept = read(this.#storage().getItem(this.#key()));
		} catch {}
		this.tab = kept === undefined ? 'wiktionary' : kept;
	}

	/** Opens `tab`, or closes it if it is the open one. */
	choose(tab: DictionaryTab) {
		this.#set(this.tab === tab ? null : tab);
	}

	/**
	 * Opens the next (or, `by` -1, the previous) of `tabs`, closed coming after the last; an open tab
	 * that isn't among them counts as closed.
	 */
	step(tabs: DictionaryTab[], by: 1 | -1) {
		const ring = [...tabs, null];
		const found = ring.indexOf(this.tab);
		const at = found === -1 ? ring.length - 1 : found;
		this.#set(ring[(at + by + ring.length) % ring.length]);
	}

	#key() {
		return `reader.dictionary.${this.#language}`;
	}

	#set(tab: DictionaryTab | null) {
		this.tab = tab;
		if (this.#language === undefined) return;
		try {
			this.#storage().setItem(this.#key(), write(tab));
		} catch {}
	}
}
