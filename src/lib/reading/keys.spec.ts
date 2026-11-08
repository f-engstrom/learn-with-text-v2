import { describe, it, expect } from 'vitest';
import { cardCommandFor, commandFor, type KeyInput } from './keys';

const press = (key: string, code = '', mods: Partial<KeyInput> = {}): KeyInput => ({
	key,
	code,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	shiftKey: false,
	...mods
});

describe('commandFor', () => {
	it('moves forward with the right arrow in left-to-right text', () => {
		expect(commandFor(press('ArrowRight'), false)).toEqual({ kind: 'move', by: 1 });
		expect(commandFor(press('ArrowLeft'), false)).toEqual({ kind: 'move', by: -1 });
	});

	it('moves forward with the left arrow in right-to-left text', () => {
		expect(commandFor(press('ArrowLeft'), true)).toEqual({ kind: 'move', by: 1 });
		expect(commandFor(press('ArrowRight'), true)).toEqual({ kind: 'move', by: -1 });
	});

	it('extends a phrase selection with Shift and the arrows, following the text direction', () => {
		expect(commandFor(press('ArrowRight', '', { shiftKey: true }), false)).toEqual({ kind: 'extend', by: 1 });
		expect(commandFor(press('ArrowRight', '', { shiftKey: true }), true)).toEqual({ kind: 'extend', by: -1 });
	});

	it('starts practice with R, on any keyboard layout', () => {
		expect(commandFor(press('r', 'KeyR'), false)).toEqual({ kind: 'practice' });
		expect(commandFor(press('к', 'KeyR'), false)).toEqual({ kind: 'practice' });
	});

	it('toggles the Due marks with D, on any keyboard layout', () => {
		expect(commandFor(press('d', 'KeyD'), false)).toEqual({ kind: 'due' });
		expect(commandFor(press('в', 'KeyD'), false)).toEqual({ kind: 'due' });
	});

	it('toggles zen mode with Z, on any keyboard layout', () => {
		expect(commandFor(press('z', 'KeyZ'), false)).toEqual({ kind: 'zen' });
		expect(commandFor(press('я', 'KeyZ'), false)).toEqual({ kind: 'zen' });
	});

	it('pastes a Translation with P, on any keyboard layout', () => {
		expect(commandFor(press('p', 'KeyP'), false)).toEqual({ kind: 'paste' });
		expect(commandFor(press('з', 'KeyP'), false)).toEqual({ kind: 'paste' });
		expect(commandFor(press('v', 'KeyV', { metaKey: true }), false)).toBeUndefined();
	});

	it('goes to the Tutor\'s question with T, on any keyboard layout', () => {
		expect(commandFor(press('t', 'KeyT'), false)).toEqual({ kind: 'tutor' });
		expect(commandFor(press('е', 'KeyT'), false)).toEqual({ kind: 'tutor' });
	});

	it('moves by Sentence with up and down', () => {
		expect(commandFor(press('ArrowDown'), false)).toEqual({ kind: 'sentence', by: 1 });
		expect(commandFor(press('ArrowUp'), true)).toEqual({ kind: 'sentence', by: -1 });
	});

	it('sets Statuses with 1–4, K and I', () => {
		expect(commandFor(press('1', 'Digit1'), false)).toEqual({ kind: 'status', status: 'learning1' });
		expect(commandFor(press('4', 'Numpad4'), false)).toEqual({ kind: 'status', status: 'learning4' });
		expect(commandFor(press('k', 'KeyK'), false)).toEqual({ kind: 'status', status: 'known' });
		expect(commandFor(press('I', 'KeyI'), false)).toEqual({ kind: 'status', status: 'ignored' });
	});

	it('uses the physical key, so a Russian layout works', () => {
		expect(commandFor(press('л', 'KeyK'), false)).toEqual({ kind: 'status', status: 'known' });
		expect(commandFor(press('ш', 'KeyI'), false)).toEqual({ kind: 'status', status: 'ignored' });
	});

	it('opens and closes the Term form with Enter and Escape', () => {
		expect(commandFor(press('Enter'), false)).toEqual({ kind: 'open' });
		expect(commandFor(press('Escape'), false)).toEqual({ kind: 'close' });
	});

	it('ignores shortcuts with modifier keys and other keys', () => {
		expect(commandFor(press('k', 'KeyK', { metaKey: true }), false)).toBeUndefined();
		expect(commandFor(press('1', 'Digit1', { ctrlKey: true }), false)).toBeUndefined();
		expect(commandFor(press('5', 'Digit5'), false)).toBeUndefined();
		expect(commandFor(press('a', 'KeyA'), false)).toBeUndefined();
	});
});

describe('cardCommandFor', () => {
	it('picks an option with 1–4, on any keyboard layout', () => {
		expect(cardCommandFor(press('1', 'Digit1'), false)).toEqual({ kind: 'pick', option: 0 });
		expect(cardCommandFor(press('4', 'Numpad4'), false)).toEqual({ kind: 'pick', option: 3 });
		expect(cardCommandFor(press('5', 'Digit5'), false)).toBeUndefined();
	});

	it('steps between questions with the arrows', () => {
		expect(cardCommandFor(press('ArrowRight'), false)).toEqual({ kind: 'step', by: 1 });
		expect(cardCommandFor(press('ArrowLeft'), false)).toEqual({ kind: 'step', by: -1 });
	});

	it('leaves the arrows and digits to a text box, where Alt+arrow steps', () => {
		expect(cardCommandFor(press('ArrowLeft'), true)).toBeUndefined();
		expect(cardCommandFor(press('1', 'Digit1'), true)).toBeUndefined();
		expect(cardCommandFor(press('ArrowLeft', '', { altKey: true }), true)).toEqual({ kind: 'step', by: -1 });
		expect(cardCommandFor(press('ArrowRight', '', { altKey: true }), false)).toEqual({ kind: 'step', by: 1 });
	});

	it('goes back to the text with Escape', () => {
		expect(cardCommandFor(press('Escape'), true)).toEqual({ kind: 'leave' });
	});

	it('ignores other keys and modifiers', () => {
		expect(cardCommandFor(press('ArrowRight', '', { shiftKey: true }), false)).toBeUndefined();
		expect(cardCommandFor(press('1', 'Digit1', { metaKey: true }), false)).toBeUndefined();
		expect(cardCommandFor(press('k', 'KeyK'), false)).toBeUndefined();
	});
});
