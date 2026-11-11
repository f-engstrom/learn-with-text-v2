import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFixtures } from './world';

describe('fixtures.json', () => {
	it('is what the domain builds today; run `pnpm fixtures` if a domain change moved it', async () => {
		const committed = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
		expect(await buildFixtures()).toEqual(committed);
		// It reads a Book of a few hundred Pages, a Page at a time.
	}, 30_000);
});
