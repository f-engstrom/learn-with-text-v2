import { describe, expect, it } from 'vitest';
import { countWords, PageDraft } from './page-draft.svelte';

const page = (id: number, text: string, readAt: string | null = null) => ({ id, position: id, text, readAt, words: 0 });

function draft() {
	return new PageDraft([page(1, 'Раз.', '2026-11-10T10:00:00Z'), page(2, 'Музыканты играли до'), page(3, 'поздней ночи.'), page(4, 'Конец.')]);
}

describe('PageDraft', () => {
	it('numbers the kept Pages, and a removed one comes back with Undo', () => {
		const d = draft();
		const [, second, third] = d.pages;
		d.remove(second);
		expect(d.numberOf(second)).toBeNull();
		expect(d.numberOf(third)).toBe(2);
		expect(d.changed).toBe(true);
		d.restore(second);
		expect(d.changed).toBe(false);
	});

	it('moves a Page past removed ones', () => {
		const d = draft();
		const [first, second, third] = d.pages;
		d.remove(second);
		d.move(first, 1);
		expect(d.kept.map((p) => p.id)).toEqual([3, 1, 4]);
		d.move(third, -1);
		expect(d.kept.map((p) => p.id)).toEqual([3, 1, 4]);
	});

	it('joins a Page cut mid-sentence into one paragraph, Read only if both were', () => {
		const d = draft();
		d.joinWithNext(d.pages[1]);
		expect(d.pages[1].text).toBe('Музыканты играли до поздней ночи.');
		d.joinWithNext(d.pages[0]);
		expect(d.pages[0]).toMatchObject({ text: 'Раз.\n\nМузыканты играли до поздней ночи.', readAt: null });
	});

	it('adds Pages after any Page or first, a --- line between them', () => {
		const d = draft();
		expect(d.addPages('Новая.\n---\n\n---\nЕщё.', d.pages[0])).toBe(2);
		d.addPages('Начало.', null);
		expect(d.kept.map((p) => p.text)).toEqual(['Начало.', 'Раз.', 'Новая.', 'Ещё.', 'Музыканты играли до', 'поздней ночи.', 'Конец.']);
	});

	it('sends the kept Pages in order, with what is still Read', () => {
		const d = draft();
		d.unmarkRead(d.pages[0]);
		d.remove(d.pages[3]);
		expect(d.toJSON()).toEqual([
			{ id: 1, text: 'Раз.', read: false },
			{ id: 2, text: 'Музыканты играли до', read: false },
			{ id: 3, text: 'поздней ночи.', read: false }
		]);
	});
});

describe('countWords', () => {
	it('counts Words by the Language, Chinese included', () => {
		expect(countWords('Жил-был кот.', 'ru')).toBe(2);
		expect(countWords('Жил — был кот, 5-й.', 'ru')).toBe(4);
		expect(countWords('我们今天学习中文。', 'zh')).toBeGreaterThan(1);
	});
});
