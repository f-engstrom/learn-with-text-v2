/** The design tokens, read from app.css itself so the theme pages cannot drift from it. */
import css from '../app.css?raw';

export type Token = {
	name: string;
	/** The declared value, e.g. `light-dark(#f6f1e7, #1a1815)`. */
	value: string;
	kind: 'colour' | 'shadow' | 'font' | 'size';
	/** The comment above the token in app.css, if it has one. */
	note?: string;
};

function kindOf(name: string, value: string): Token['kind'] {
	if (name.startsWith('--shadow')) return 'shadow';
	if (name.startsWith('--font')) return 'font';
	if (value.includes('light-dark(') || value.startsWith('#')) return 'colour';
	return 'size';
}

/** Every custom property declared in the first `:root` block of a stylesheet, in order. */
export function readTokens(source: string = css): Token[] {
	const start = source.indexOf(':root {');
	const block = source.slice(start, source.indexOf('\n}', start));
	const tokens: Token[] = [];
	const declaration = /(?:\/\*\s*([^*]*?)\s*\*\/\s*)?(--[\w-]+):\s*([^;]+);/g;
	for (const [, note, name, raw] of block.matchAll(declaration)) {
		const value = raw.replace(/\s+/g, ' ').trim();
		tokens.push({ name, value, kind: kindOf(name, value), note: note || undefined });
	}
	return tokens;
}
