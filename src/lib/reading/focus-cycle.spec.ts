import { describe, expect, it } from 'vitest';
import { guardSends } from './focus-cycle.ts';

describe('guardSends', () => {
	it('sends Tab past the last stop around to the first', () => {
		expect(guardSends('end', 'inside')).toBe('first');
	});

	it('sends Shift+Tab before the first stop around to the last', () => {
		expect(guardSends('start', 'inside')).toBe('last');
	});

	it('takes Tab coming in from outside to the end it came in at', () => {
		expect(guardSends('start', 'outside')).toBe('first');
		expect(guardSends('end', 'outside')).toBe('last');
	});
});
