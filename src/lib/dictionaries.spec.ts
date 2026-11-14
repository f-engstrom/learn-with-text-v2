import { describe, expect, it } from 'vitest';
import { isWiktionary, lookupUrl } from './dictionaries.ts';

describe('lookupUrl', () => {
	it('puts the encoded Normalised form in place of [TERM]', () => {
		expect(lookupUrl({ url: 'https://en.openrussian.org/ru/[TERM]' }, 'привыкший')).toBe(
			'https://en.openrussian.org/ru/%D0%BF%D1%80%D0%B8%D0%B2%D1%8B%D0%BA%D1%88%D0%B8%D0%B9'
		);
	});
});

describe('isWiktionary', () => {
	it('is a Wiktionary page shown in the panel', () => {
		expect(isWiktionary({ url: 'https://en.m.wiktionary.org/wiki/[TERM]#Russian', display: 'embedded' })).toBe(true);
		expect(isWiktionary({ url: 'https://en.wiktionary.org/wiki/[TERM]', display: 'embedded' })).toBe(true);
	});

	it('is not another site, a window, or an address that does not parse', () => {
		expect(isWiktionary({ url: 'https://en.openrussian.org/ru/[TERM]', display: 'embedded' })).toBe(false);
		expect(isWiktionary({ url: 'https://notwiktionary.org/[TERM]', display: 'embedded' })).toBe(false);
		expect(isWiktionary({ url: 'https://en.m.wiktionary.org/wiki/[TERM]', display: 'popup' })).toBe(false);
		expect(isWiktionary({ url: '[TERM]', display: 'embedded' })).toBe(false);
	});
});
