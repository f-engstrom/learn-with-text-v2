/** `pnpm fixtures`: writes the stories' fixtures, built by the domain (see world.ts). */
import { writeFileSync } from 'node:fs';
import { buildFixtures } from './world';

const file = new URL('./fixtures.json', import.meta.url);
writeFileSync(file, JSON.stringify(await buildFixtures(), null, '\t') + '\n');
console.log(`Wrote ${file.pathname}`);
