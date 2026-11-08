import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistedFlag, type FlagStorage } from './persisted-flag.svelte.ts';
import { Zen } from './zen.svelte.ts';

function memory(initial: Record<string, string> = {}): FlagStorage & { items: Record<string, string> } {
	const items = { ...initial };
	return { items, getItem: (k) => items[k] ?? null, setItem: (k, v) => void (items[k] = v) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('PersistedFlag', () => {
	it('starts at its default, reads what was kept on load, and keeps what you set', () => {
		const storage = memory({ 'reader.due': 'off' });
		const flag = new PersistedFlag('reader.due', true, () => storage);
		expect(flag.value).toBe(true);
		flag.load();
		expect(flag.value).toBe(false);
		flag.toggle();
		expect(storage.items['reader.due']).toBe('on');
	});

	it('stays at its default when storage refuses', () => {
		const flag = new PersistedFlag('reader.due', true, () => {
			throw new Error('private browsing');
		});
		flag.load();
		flag.set(false);
		expect(flag.value).toBe(false);
	});
});

describe('Zen mode', () => {
	function open(stored?: 'on' | 'off') {
		const storage = memory(stored ? { 'reader.zen': stored } : {});
		const onChange = vi.fn();
		const zen = new Zen({ storage: () => storage, idleMs: 100, onChange });
		zen.load();
		return { zen, storage, onChange };
	}

	it('comes back on if you left it on, and hides the controls when you stop moving', () => {
		const { zen } = open('on');
		expect(zen.on).toBe(true);
		vi.advanceTimersByTime(100);
		expect(zen.idle).toBe(true);
		zen.wake();
		expect(zen.idle).toBe(false);
	});

	it('shows a tapped Word’s Translations, and hides them when you tap it again or outside', () => {
		const { zen } = open('on');
		zen.tapWord(false);
		expect(zen.glossShown).toBe(true);
		zen.tapWord(false);
		expect(zen.glossShown).toBe(true);
		zen.tapWord(true);
		expect(zen.glossShown).toBe(false);
		zen.tapWord(false);
		zen.tapOutside();
		expect(zen.glossShown).toBe(false);
	});

	it('hides the tooltip on Escape, and leaves on the next', () => {
		const { zen, storage, onChange } = open('on');
		zen.enter();
		zen.escape();
		expect(zen.on).toBe(true);
		zen.escape();
		expect(zen.on).toBe(false);
		expect(storage.items['reader.zen']).toBe('off');
		expect(onChange).toHaveBeenCalledWith(false);
	});

	it('leaves for practice only when on', () => {
		const { zen, onChange } = open('off');
		zen.leave();
		expect(onChange).not.toHaveBeenCalled();
		zen.toggle();
		zen.leave();
		expect(zen.on).toBe(false);
	});
});
