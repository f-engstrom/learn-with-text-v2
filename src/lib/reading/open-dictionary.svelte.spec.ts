import { describe, expect, it } from 'vitest';
import type { FlagStorage } from './persisted-flag.svelte.ts';
import { OpenDictionary, panelTabs } from './open-dictionary.svelte.ts';

function memory(initial: Record<string, string> = {}): FlagStorage & { items: Record<string, string> } {
	const items = { ...initial };
	return { items, getItem: (k) => items[k] ?? null, setItem: (k, v) => void (items[k] = v) };
}

describe('OpenDictionary', () => {
	it('opens Wiktionary until you choose', () => {
		const open = new OpenDictionary(() => memory());
		open.load(1);
		expect(open.tab).toBe('wiktionary');
	});

	it('closes the open tab when you choose it again, and keeps that closed', () => {
		const storage = memory();
		const open = new OpenDictionary(() => storage);
		open.load(1);
		open.choose('wiktionary');
		expect(open.tab).toBeNull();
		expect(storage.items['reader.dictionary.1']).toBe('none');
		open.load(1);
		expect(open.tab).toBeNull();
	});

	it('keeps a choice for each Language', () => {
		const storage = memory({ 'reader.dictionary.1': 'd:7', 'reader.dictionary.2': 'azure' });
		const open = new OpenDictionary(() => storage);
		open.load(1);
		expect(open.tab).toBe(7);
		open.load(2);
		expect(open.tab).toBe('azure');
		open.choose(9);
		expect(storage.items).toEqual({ 'reader.dictionary.1': 'd:7', 'reader.dictionary.2': 'd:9' });
	});

	it('steps through the tabs and closed, either way round', () => {
		const open = new OpenDictionary(() => memory());
		open.load(1);
		const tabs = ['wiktionary' as const, 'azure' as const, 7];
		open.step(tabs, 1);
		expect(open.tab).toBe('azure');
		open.step(tabs, 1);
		open.step(tabs, 1);
		expect(open.tab).toBeNull();
		open.step(tabs, 1);
		expect(open.tab).toBe('wiktionary');
		open.step(tabs, -1);
		expect(open.tab).toBeNull();
	});

	it('steps from a tab that is not among them as from closed', () => {
		const open = new OpenDictionary(() => memory({ 'reader.dictionary.1': 'azure' }));
		open.load(1);
		open.step(['wiktionary', 7], 1);
		expect(open.tab).toBe('wiktionary');
	});

	it('still works when storage refuses', () => {
		const open = new OpenDictionary(() => {
			throw new Error('private browsing');
		});
		open.load(1);
		open.choose('azure');
		expect(open.tab).toBe('azure');
	});
});

describe('panelTabs', () => {
	const dictionaries = [
		{ id: 7, display: 'embedded' as const },
		{ id: 8, display: 'popup' as const }
	];

	it('are Wiktionary, Azure and the embedded Dictionaries, without the popups', () => {
		expect(panelTabs(dictionaries, true)).toEqual(['wiktionary', 'azure', 7]);
	});

	it('leave Azure out when it is not set up', () => {
		expect(panelTabs(dictionaries, false)).toEqual(['wiktionary', 7]);
	});
});

describe('reaching the panel by L', () => {
	it('goes to the open tab from outside the panel, and steps on from inside it', () => {
		const open = new OpenDictionary(() => memory());
		open.load(1);
		const tabs = panelTabs([], true);
		open.reach(tabs, 1, false);
		expect(open.tab).toBe('wiktionary');
		open.reach(tabs, 1, true);
		expect(open.tab).toBe('azure');
		open.reach(tabs, -1, false);
		expect(open.tab).toBe('wiktionary');
	});

	it('opens the first tab when going to a closed panel', () => {
		const open = new OpenDictionary(() => memory({ 'reader.dictionary.1': 'none' }));
		open.load(1);
		open.reach(panelTabs([], true), 1, false);
		expect(open.tab).toBe('wiktionary');
	});
});
