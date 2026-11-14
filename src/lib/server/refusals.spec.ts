import { describe, it, expect } from 'vitest';
import { isActionFailure, isHttpError } from '@sveltejs/kit';
import { InvalidBookmark } from './domain/reading';
import { InvalidTerm } from './domain/terms';
import { refusedAsError, refusedAsFailure } from './refusals';

const refuse = (e: Error) => async () => {
	throw e;
};

describe('refusedAsError', () => {
	it('answers any broken rule with 400 and its message', async () => {
		for (const e of [new InvalidTerm('Choose a Status.'), new InvalidBookmark('No such Page.')]) {
			const thrown = await refusedAsError(refuse(e)).catch((x) => x);
			expect(isHttpError(thrown, 400)).toBe(true);
			expect(thrown.body.message).toBe(e.message);
		}
	});

	it('passes the result through, and anything else unchanged', async () => {
		expect(await refusedAsError(async () => 7)).toBe(7);
		const crash = new TypeError('boom');
		await expect(refusedAsError(refuse(crash))).rejects.toBe(crash);
	});
});

describe('refusedAsFailure', () => {
	it('returns any broken rule as a 400 failure with its message and the extra fields', async () => {
		const result = await refusedAsFailure<void, { values: { text: string } }>(refuse(new InvalidTerm('Choose a Status.')), { values: { text: 'кот' } });
		expect(isActionFailure(result)).toBe(true);
		if (!isActionFailure(result)) return;
		expect(result.status).toBe(400);
		expect(result.data).toEqual({ message: 'Choose a Status.', values: { text: 'кот' } });
	});

	it('passes the result through, and anything else unchanged', async () => {
		expect(await refusedAsFailure(async () => 3)).toBe(3);
		const crash = new TypeError('boom');
		await expect(refusedAsFailure(refuse(crash))).rejects.toBe(crash);
	});
});
