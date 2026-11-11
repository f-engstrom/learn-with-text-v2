/**
 * A story's snapshots, taken after it has rendered and its play function has run (`pnpm test:visual`).
 * Every story in light at desktop width; a screen also in dark and at phone width, and the reading
 * screen at tablet width too (ADR 0007). The snapshots are in ./snapshots and are not committed: they are
 * taken before a design change (`pnpm test:visual:update`) and compared after it.
 */
import { expect } from 'vitest';
import { page } from 'vitest/browser';

interface Variant {
	name: string;
	theme: 'light' | 'dark';
	width: number;
	height: number;
}

const desktop: Variant = { name: 'light', theme: 'light', width: 1280, height: 900 };

function variantsOf(title: string): Variant[] {
	if (!title.startsWith('Screens/')) return [desktop];
	return [
		desktop,
		{ ...desktop, name: 'dark', theme: 'dark' },
		{ name: 'phone', theme: 'light', width: 390, height: 844 },
		...(title === 'Screens/Reading' ? [{ name: 'tablet', theme: 'light' as const, width: 820, height: 1180 }] : [])
	];
}

/** Nothing moves or blinks while a snapshot is taken. */
function still(): () => void {
	const style = document.createElement('style');
	style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; scroll-behavior: auto !important; }';
	document.head.append(style);
	return () => style.remove();
}

/** Resolves once the screen has been laid out at its new size and its height has stopped changing. */
async function settled(root: HTMLElement): Promise<void> {
	const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
	await document.fonts.ready;
	let height = -1;
	for (let i = 0; i < 20 && height !== root.scrollHeight; i++) {
		height = root.scrollHeight;
		await frame();
		await frame();
	}
}

export async function snapshot(story: { id: string; title: string }): Promise<void> {
	const root = document.documentElement;
	const theme = root.dataset.theme;
	const move = still();
	try {
		for (const variant of variantsOf(story.title)) {
			root.dataset.theme = variant.theme;
			// The whole screen from its top, not what fits the window or where the story scrolled to: the frame
			// grows until nothing is left to scroll (up to the browser window's own height).
			let height = variant.height;
			for (let i = 0; i < 5; i++) {
				await page.viewport(variant.width, height);
				await settled(root);
				if (root.scrollHeight <= height || height >= 10000) break;
				height = Math.min(root.scrollHeight, 10000);
			}
			for (const scrolled of [root, ...document.querySelectorAll('*')]) if (scrolled.scrollTop) scrolled.scrollTop = 0;
			await settled(root);
			await expect(page.elementLocator(document.body)).toMatchScreenshot(`${story.id}--${variant.name}`, { timeout: 15_000 });
		}
	} finally {
		move();
		if (theme) root.dataset.theme = theme;
		await page.viewport(desktop.width, desktop.height);
	}
}
