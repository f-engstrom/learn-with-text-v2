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
	const status = statusKeys[e.code];
	return status && { kind: 'status', status };
}
