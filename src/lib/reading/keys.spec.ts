import { describe, it, expect } from 'vitest';
import { commandFor, type KeyInput } from './keys';

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

	it('pastes a Translation with P, on any keyboard layout', () => {
		expect(commandFor(press('p', 'KeyP'), false)).toEqual({ kind: 'paste' });
		expect(commandFor(press('з', 'KeyP'), false)).toEqual({ kind: 'paste' });
		expect(commandFor(press('v', 'KeyV', { metaKey: true }), false)).toBeUndefined();
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
