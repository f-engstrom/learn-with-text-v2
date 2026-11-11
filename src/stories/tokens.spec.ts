import { describe, expect, it } from 'vitest';
import { readTokens } from './tokens';

const css = `
/* intro */
:root {
	color-scheme: light dark;
	--bg: light-dark(#fff, #000);
	--shadow:
		0 1px 2px light-dark(rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.5)),
		0 2px 4px #000;
	/* Reading text. */
	--font-text: 'Iowan Old Style', serif;
	--radius: 0.5rem;
}
:root[data-theme='dark'] { --other: 1; }
`;

describe('readTokens', () => {
	it('lists the custom properties of the first :root block with their kind', () => {
		expect(readTokens(css)).toEqual([
			{ name: '--bg', value: 'light-dark(#fff, #000)', kind: 'colour', note: undefined },
			{
				name: '--shadow',
				value: '0 1px 2px light-dark(rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.5)), 0 2px 4px #000',
				kind: 'shadow',
				note: undefined
			},
			{ name: '--font-text', value: "'Iowan Old Style', serif", kind: 'font', note: 'Reading text.' },
			{ name: '--radius', value: '0.5rem', kind: 'size', note: undefined }
		]);
	});
});
