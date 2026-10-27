import { describe, it, expect } from 'vitest';
import { actionUrl } from './actions';

describe('actionUrl', () => {
	it("keeps the page's query string before the action", () => {
		expect(actionUrl('saveTerm', '')).toBe('?/saveTerm');
		expect(actionUrl('saveTerm', '?source=tutor&q=cat')).toBe('?source=tutor&q=cat&/saveTerm');
	});
});
