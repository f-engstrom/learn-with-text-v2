import type { Status } from '#lib/server/domain/terms.ts';

export type Command =
	| { kind: 'move'; by: 1 | -1 }
	/** Shift+arrow: grow or shrink a phrase selection by one Word. */
	| { kind: 'extend'; by: 1 | -1 }
	| { kind: 'sentence'; by: 1 | -1 }
	| { kind: 'status'; status: Status }
	| { kind: 'open' }
	/** Add the clipboard text as a Translation of the selection. */
	| { kind: 'paste' }
	/** Zen mode on or off. */
	| { kind: 'zen' }
	/** Due marks on or off. */
	| { kind: 'due' }
	/** Start practising the Page's Due Words. */
	| { kind: 'practice' }
	/** Go to the Tutor's question. */
	| { kind: 'tutor' }
	/** Open the next (Shift: the previous) Dictionary in the Term panel, or close it after the last. */
	| { kind: 'dictionary'; by: 1 | -1 }
	| { kind: 'close' };

export type KeyInput = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

// Matched by physical key (`code`), so they work with a Russian or Farsi keyboard layout too.
const statusKeys: Record<string, Status> = {
	Digit1: 'learning1',
	Digit2: 'learning2',
	Digit3: 'learning3',
	Digit4: 'learning4',
	Numpad1: 'learning1',
	Numpad2: 'learning2',
	Numpad3: 'learning3',
	Numpad4: 'learning4',
	KeyK: 'known',
	KeyI: 'ignored'
};

/**
 * The reading command for a key press, if any. Left and right follow the text's direction on
 * screen, so in a right-to-left Page the left arrow moves to the next Word.
 */
export function commandFor(e: KeyInput, rightToLeft: boolean): Command | undefined {
	if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
	const forward = rightToLeft ? 'ArrowLeft' : 'ArrowRight';
	const back = rightToLeft ? 'ArrowRight' : 'ArrowLeft';
	switch (e.key) {
		case forward:
			return { kind: e.shiftKey ? 'extend' : 'move', by: 1 };
		case back:
			return { kind: e.shiftKey ? 'extend' : 'move', by: -1 };
		case 'ArrowDown':
			return { kind: 'sentence', by: 1 };
		case 'ArrowUp':
			return { kind: 'sentence', by: -1 };
		case 'Enter':
			return { kind: 'open' };
		case 'Escape':
			return { kind: 'close' };
	}
	if (e.code === 'KeyP') return { kind: 'paste' };
	if (e.code === 'KeyZ') return { kind: 'zen' };
	if (e.code === 'KeyD') return { kind: 'due' };
	if (e.code === 'KeyR') return { kind: 'practice' };
	if (e.code === 'KeyT') return { kind: 'tutor' };
	if (e.code === 'KeyL') return { kind: 'dictionary', by: e.shiftKey ? -1 : 1 };
	const status = statusKeys[e.code];
	return status && { kind: 'status', status };
}

/** What a key does in the Tutor's card: pick an option, step between questions, or go back to the text. */
export type CardCommand = { kind: 'pick'; option: number } | { kind: 'step'; by: 1 | -1 } | { kind: 'leave' };

/**
 * The card's command for a key press, if any. 1–4 pick an option and the arrows step between
 * questions; in a text box the arrows move the caret, so stepping there takes Alt+arrow
 * (which works everywhere in the card).
 */
export function cardCommandFor(e: KeyInput, typing: boolean): CardCommand | undefined {
	if (e.ctrlKey || e.metaKey || e.shiftKey) return undefined;
	if (e.key === 'Escape' && !e.altKey) return { kind: 'leave' };
	if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
		if (typing && !e.altKey) return undefined;
		return { kind: 'step', by: e.key === 'ArrowRight' ? 1 : -1 };
	}
	const digit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code)?.[1];
	if (digit && !typing && !e.altKey) return { kind: 'pick', option: Number(digit) - 1 };
	return undefined;
}

/** Where a key landed and what the reading screen is doing, for `routeKey`. */
export interface KeyFacts {
	/** Something already handled it. */
	handled: boolean;
	/** In the Tutor's card, which has its own keys. */
	inTutorCard: boolean;
	/** In a text field: only Escape (close) applies there. */
	typing: boolean;
	/** On a button or link, which handles Enter itself. */
	onControl: boolean;
	zen: boolean;
	/** The reading command for the key, from `commandFor`. */
	command: Command | undefined;
	/** Offers the key to Practice, which handles it and says whether it took it. Asked only in its turn. */
	practice: () => boolean;
}

/** Who acts on a key; each route but `none` means the key is used up. */
export type KeyRoute =
	| { to: 'none' }
	| { to: 'practice' }
	| { to: 'zen'; key: 'enter' | 'escape' }
	| { to: 'reading'; command: Command };

/**
 * Who a key goes to, in order: the Tutor's card, Practice, zen mode's Enter and Escape, and then the
 * reading command, unless you're typing or Enter is on a button.
 */
export function routeKey(facts: KeyFacts): KeyRoute {
	const { command } = facts;
	if (facts.handled || facts.inTutorCard) return { to: 'none' };
	if (!facts.typing && facts.practice()) return { to: 'practice' };
	if (facts.zen && command?.kind === 'open') return { to: 'zen', key: 'enter' };
	if (facts.zen && command?.kind === 'close') return { to: 'zen', key: 'escape' };
	if (!command || (facts.typing && command.kind !== 'close')) return { to: 'none' };
	if (command.kind === 'open' && facts.onControl) return { to: 'none' };
	return { to: 'reading', command };
}
