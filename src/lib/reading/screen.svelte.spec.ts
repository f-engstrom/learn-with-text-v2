import { describe, it, expect, vi } from 'vitest';
import { tick } from 'svelte';
import { openDatabase } from '#lib/server/db/open.ts';
import { migrateToLatest } from '#lib/server/db/migrate.ts';
import { listLanguages } from '#lib/server/domain/languages.ts';
import { createBook } from '#lib/server/domain/books.ts';
import { recordReview } from '#lib/server/domain/practice.ts';
import { saveTerm, type Status } from '#lib/server/domain/terms.ts';
import { readingScreenData } from '#lib/server/reading-screen.ts';
import type { KeyInput } from './keys.ts';
import { ReadingScreen, type KeyPlace, type View } from './screen.svelte.ts';

const text = 'Кот спит на диване. Мышь бежит, а кот смотрит.\n\nВторой абзац здесь.\n\n---\n\nВторая страница.';

/** A Book on a database in memory, and a ReadingScreen on its first Page whose server is that database. */
async function setup({ refuse }: { refuse?: string } = {}) {
	const db = openDatabase(':memory:');
	await migrateToLatest(db);
	const language = (await listLanguages(db)).find((l) => l.code === 'ru')!;
	const bookId = await createBook(db, { languageId: language.id, title: 'Test', text });
	let position = 1;
	const load = async () => (await readingScreenData(db, bookId, position, { azureReady: false }))!;

	const view: View = {
		focusWord: vi.fn(),
		scrollToWord: vi.fn(),
		scrollToHighlight: vi.fn(),
		focusTutor: vi.fn(),
		paste: vi.fn(async () => undefined),
		inDictionary: () => false,
		reachDictionary: vi.fn(async () => undefined)
	};
	const kept = new Map<string, string>();
	const screen: ReadingScreen = new ReadingScreen(await load(), {
		view,
		storage: () => ({ getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) }),
		server: {
			// As invalidateAll does: the load runs again and its result comes back through sync.
			reload: async () => screen.sync(await load()),
			sendStatus: async (languageId, text, status) => {
				if (refuse) return refuse;
				await saveTerm(db, { languageId, text, status });
			},
			sendReview: async (termId, grade) => {
				if (refuse) return refuse;
				await recordReview(db, termId, grade, 'page');
			},
			saveBookmark: () => undefined,
			tutor: { get: async () => undefined, answer: async () => undefined, dismiss: async () => undefined }
		}
	});
	screen.sync(await load());
	screen.start();

	const place: KeyPlace = { handled: false, inTutorCard: false, typing: false, onControl: false };
	const press = (key: string, code = '', where: Partial<KeyPlace> = {}) =>
		screen.key({ key, code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false } as KeyInput, { ...place, ...where });
	const index = (word: string) => screen.selection.words.findIndex((w) => w.text === word);
	const goTo = async (to: number) => {
		position = to;
		screen.sync(await load());
	};
	return { db, language, bookId, screen, view, kept, press, index, goTo, load };
}

describe('ReadingScreen', () => {
	it('opens the Term panel on a Word you choose, and Escape closes it', async () => {
		const { screen, view, press, index } = await setup();
		screen.choose(index('спит'), false);
		expect(screen.open).toBe(true);
		expect(screen.selection.selected?.text).toBe('спит');
		await tick();
		expect(view.scrollToWord).toHaveBeenCalledWith(index('спит'), 'nearest');

		expect(press('Escape')).toBe(true);
		expect(screen.open).toBe(false);
	});

	it('closes the Term panel on a tap outside it, leaving the Selection and focus where they were', async () => {
		const { screen, view, index } = await setup();
		screen.tapOutside();
		expect(screen.open).toBe(false);

		screen.choose(index('спит'), false);
		await tick();
		vi.mocked(view.focusWord).mockClear();
		screen.tapOutside();
		expect(screen.open).toBe(false);
		expect(screen.selection.selected?.text).toBe('спит');
		// Focusing the Word would scroll a phone's page under the finger.
		await tick();
		expect(view.focusWord).not.toHaveBeenCalled();
	});

	it('makes a phrase from a held Word, as Shift-click does', async () => {
		const { screen, index } = await setup();
		screen.choose(index('Кот'), false);
		screen.choose(index('на'), true);
		expect(screen.open).toBe(true);
		expect(screen.selection.selected?.text).toBe('Кот спит на');
	});

	it('opens with Enter only once something is selected, and not from a button', async () => {
		const { screen, press } = await setup();
		press('Enter');
		expect(screen.open).toBe(false);
		press('ArrowRight');
		expect(press('Enter', '', { onControl: true })).toBe(false);
		expect(screen.open).toBe(false);
		press('Enter');
		expect(screen.open).toBe(true);
	});

	it('shows a Status set by key at once, and the saved one after reloading', async () => {
		const { screen, press } = await setup();
		press('ArrowRight');
		const key = screen.selection.selected!.key;
		press('2', 'Digit2');
		// Before the server answers, the Word already shows it.
		expect(screen.statusOf(key)).toBe('learning2');
		await vi.waitFor(() => expect(screen.term?.status).toBe('learning2'));
		expect(screen.statusOf(key)).toBe('learning2');
		expect(screen.error).toBeUndefined();
	});

	it('shows why a Status was refused, and goes back to what was saved', async () => {
		const { screen, press } = await setup({ refuse: 'No.' });
		press('ArrowRight');
		const key = screen.selection.selected!.key;
		press('k', 'KeyK');
		await vi.waitFor(() => expect(screen.error).toBe('No.'));
		await vi.waitFor(() => expect(screen.statusOf(key)).toBe('unknown'));
	});

	it('closes the Term panel and clears the error on another Page', async () => {
		const { screen, press, goTo } = await setup({ refuse: 'No.' });
		press('ArrowRight');
		press('Enter');
		press('k', 'KeyK');
		await vi.waitFor(() => expect(screen.error).toBe('No.'));
		await goTo(1);
		// The same Page reloaded keeps both.
		expect(screen.open).toBe(true);
		expect(screen.error).toBe('No.');
		await goTo(2);
		expect(screen.open).toBe(false);
		expect(screen.error).toBeUndefined();
	});

	it('in zen mode shows a tapped Word’s Translations instead of the Term panel', async () => {
		const { db, language, screen, press, index, load } = await setup();
		await saveTerm(db, { languageId: language.id, text: 'кот', status: 'learning1', translations: [{ text: 'cat' }] });
		screen.sync(await load());
		screen.choose(index('спит'), false);
		expect(screen.open).toBe(true);
		press('z', 'KeyZ');
		expect(screen.zen.on).toBe(true);
		// Zen mode closes the panel.
		expect(screen.open).toBe(false);

		screen.choose(index('Кот'), false);
		expect(screen.open).toBe(false);
		expect(screen.gloss).toBe('cat');
		screen.choose(index('спит'), false);
		expect(screen.gloss).toBe('No Translation yet');
		// Enter and Escape act on the tooltip, then leave zen mode.
		press('Enter');
		expect(screen.gloss).toBe('');
		press('Escape');
		expect(screen.zen.on).toBe(false);
	});

	it('keeps zen mode, Due marks and the open Dictionary in this browser', async () => {
		const { press, kept } = await setup();
		press('z', 'KeyZ');
		press('d', 'KeyD');
		expect(kept.get('reader.zen')).toBe('on');
		expect(kept.get('reader.due')).toBe('off');
	});

	it('starts Practice with R, leaving zen mode and closing the Term panel', async () => {
		const { screen, press, index } = await setup();
		screen.choose(index('спит'), false);
		press('z', 'KeyZ');
		press('r', 'KeyR');
		expect(screen.zen.on).toBe(false);
		expect(screen.open).toBe(false);
		expect(screen.practice.state).toEqual({ stage: 'choose' });
		// Practice takes its own keys first; Escape stops it.
		press('Escape');
		expect(screen.practice.state).toBeUndefined();
	});

	it('counts the Due Terms on the Page only while the Due marks are on', async () => {
		const { db, language, screen, press, load } = await setup();
		const id = await saveTerm(db, { languageId: language.id, text: 'кот', status: 'learning1' as Status });
		await recordReview(db, id, 'missed', 'page', new Date(2020, 0, 1));
		screen.sync(await load());
		expect(screen.dueOnPage).toBe(1);
		expect(screen.overdueOf('кот')).toBeGreaterThan(0);
		press('d', 'KeyD');
		expect(screen.dueOnPage).toBe(0);
		expect(screen.overdueOf('кот')).toBe(0);
	});

	it('shows why a Review from the Term panel was refused', async () => {
		const { db, language, screen } = await setup({ refuse: 'Not Due.' });
		const id = await saveTerm(db, { languageId: language.id, text: 'кот', status: 'learning1' });
		await screen.review(id, 'got');
		expect(screen.error).toBe('Not Due.');
	});

	it('pastes into the Term panel, opening it, only with something selected', async () => {
		const { screen, view, press } = await setup();
		await screen.paste('кошка');
		expect(view.paste).not.toHaveBeenCalled();
		press('ArrowRight');
		await screen.paste('кошка');
		expect(screen.open).toBe(true);
		expect(view.paste).toHaveBeenCalledWith('кошка');
	});

	it('goes to the Dictionary panel with L, but not in zen mode', async () => {
		const { screen, view, press } = await setup();
		press('ArrowRight');
		press('l', 'KeyL');
		await vi.waitFor(() => expect(view.reachDictionary).toHaveBeenCalledOnce());
		expect(screen.open).toBe(true);
		press('z', 'KeyZ');
		press('l', 'KeyL');
		await tick();
		expect(view.reachDictionary).toHaveBeenCalledOnce();
	});

	it('leaves the Tutor’s turn for the cursor, or the first Word', async () => {
		const { screen, press } = await setup();
		screen.leaveTutor();
		expect(screen.selection.cursor).toBe(0);
		press('ArrowRight');
		screen.leaveTutor();
		expect(screen.selection.cursor).toBe(1);
	});

	it('ignores reading keys while you type, except Escape', async () => {
		const { screen, press } = await setup();
		press('ArrowRight');
		press('Enter');
		expect(press('k', 'KeyK', { typing: true })).toBe(false);
		expect(press('Escape', '', { typing: true })).toBe(true);
		expect(screen.open).toBe(false);
	});

	it('polls From the Tutor over HTTP unless given another way', async () => {
		const db = openDatabase(':memory:');
		await migrateToLatest(db);
		const language = (await listLanguages(db)).find((l) => l.code === 'ru')!;
		const bookId = await createBook(db, { languageId: language.id, title: 'Test', text });
		const data = (await readingScreenData(db, bookId, 1, { azureReady: false }))!;
		const fetch = vi.fn(async () => new Response(null, { status: 503 }));
		vi.stubGlobal('fetch', fetch);
		vi.useFakeTimers();
		try {
			const screen = new ReadingScreen(data, {
				view: {} as View,
				server: { reload: async () => undefined, saveBookmark: () => undefined },
				storage: () => ({ getItem: () => null, setItem: () => undefined })
			});
			const stop = screen.start();
			await vi.advanceTimersByTimeAsync(2000);
			expect(fetch).toHaveBeenCalledWith(`/books/${bookId}/tutor`);
			stop();
		} finally {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		}
	});
});
